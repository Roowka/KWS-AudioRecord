const tf = require("@tensorflow/tfjs");

const modelUrl = process.env.PUBLIC_URL + "/tfjs_model/model.json";

let mediaRecorder;
let audioContext;
let audioStream;
let recordedChunks = [];

async function startAudioRecording() {
  try {
    console.log("Starting recording...");
    if (!audioContext) {
      audioContext = getAudioContext();
    }
    if (!audioStream) {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    if (!mediaRecorder) {
      mediaRecorder = new MediaRecorder(audioStream);
      mediaRecorder.ondataavailable = (event) =>
        recordedChunks.push(event.data);
      mediaRecorder.onstop = processAudioV2;
    }
    mediaRecorder.start(1000);
  } catch (error) {
    throw error;
  }
}

async function stopMediaRecording() {
  console.log("Stopping recording...");
  stopAudioStream();
  mediaRecorder.stop();
  mediaRecorder = null;
}

async function processAudioV2() {
  try {
    const audioBlob = new Blob(recordedChunks, { type: "audio/wav" });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audioPlayback = document.getElementById("audioPlayback");
    audioPlayback.src = audioUrl;
    recordedChunks.length = 0;

    const audioBuffer = await forceDurationToOneSecond(audioBlob);
    //const audioBuffer = await decodeAudioFile(audioBlob);

    const inputTensor = processAudioBuffer(audioBuffer);

    const model = await loadModel();
    const outputTensor = await model.executeAsync(inputTensor);
    // const result = await handlePrediction(outputTensor);
    // document.getElementById("predictionOutput").textContent = `Prediction: ${
    //   result.label
    // } with probability ${result.probability.toFixed(2)}`;
  } catch (error) {
    throw error;
  }
}

//   async function processAudio() {
//   const audioBlob = new Blob(recordedChunks, { type: "audio/wav" });
//   const audioBuffer = await decodeAudioBlob(audioBlob);
//   let data = getChannelData(audioBuffer);
//   // Ajuster les données pour correspondre à la forme [128, 128]
//   const adjustedData = adjustDataToShape(data, [128, 128]);
//   // Créer le tenseur
//   const tensor = createTensor(adjustedData, [128, 128]);
//   const model = await loadModel();
//   const outputTensor = await model.executeAsync(tensor);
//   const result = await handlePrediction(outputTensor);
//   const textArea = document.getElementById("textArea");
//   textArea.innerHTML = result;
//   const audioUrl = URL.createObjectURL(audioBlob);
//   const audioPlayback = document.getElementById("audioPlayback");
//   audioPlayback.src = audioUrl;
//   recordedChunks.length = 0; // Réinitialiser les chunks après traitement
// }

function stopAudioStream() {
  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
  }
}

/**
 * Initializes the audio context for the browser.
 * @returns {AudioContext} The initialized audio context.
 */
function getAudioContext() {
  console.log("Initializing audio context...");
  return new (window.AudioContext || window.webkitAudioContext)();
}

/**
 * Asynchronously loads the TensorFlow model from a specified path.
 * @returns {Promise<tf.GraphModel>} The loaded TensorFlow model.
 */
async function loadModel() {
  return await tf.loadGraphModel(modelUrl);
}

/**
 * Reads an audio file and decodes it into an AudioBuffer.
 * @param {File} file The audio file to read.
 * @returns {Promise<AudioBuffer>} The decoded AudioBuffer.
 */
async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = getAudioContext();
  return await audioContext.decodeAudioData(arrayBuffer);
}

async function forceDurationToOneSecond(audioBlob) {
  const audioBuffer = await decodeAudioFile(audioBlob);

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const oneSecondFrameCount = sampleRate * 1; // 1 second worth of frames

  // Create a new AudioBuffer of 1 second duration
  const newAudioBuffer = new AudioContext().createBuffer(
    numberOfChannels,
    oneSecondFrameCount,
    sampleRate
  );

  // Copy original data into the new buffer
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const oldChannelData = audioBuffer.getChannelData(channel);
    const newChannelData = newAudioBuffer.getChannelData(channel);
    // Copy data from old buffer to new buffer, truncating or padding as needed
    newChannelData.set(oldChannelData.subarray(0, oneSecondFrameCount));
  }

  return newAudioBuffer;
}

/**
 * Processes the audio buffer to match the input requirements of the TensorFlow model.
 * @param {AudioBuffer} audioBuffer The audio buffer to process.
 * @returns {tf.Tensor3D} The processed audio as a 3D tensor.
 */
function processAudioBuffer(audioBuffer) {
  const targetSampleRate = 16000;
  const inputLength = 16000;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.duration * targetSampleRate,
    targetSampleRate
  );

  const bufferSource = offlineContext.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineContext.destination);
  bufferSource.start(0);

  return offlineContext.startRendering().then((renderedBuffer) => {
    let inputData = renderedBuffer.getChannelData(0);
    if (inputData.length > inputLength) {
      inputData = inputData.slice(0, inputLength);
    } else if (inputData.length < inputLength) {
      // Fill the remaining input with zeros if the audio is too short
      inputData = new Float32Array(inputLength).fill(0, 0, inputLength);
      inputData.set(renderedBuffer.getChannelData(0));
    }
    return tf.tensor3d(inputData, [1, inputLength, 1]);
  });
}

/**
 * Handles the TensorFlow model predictions by displaying the most likely prediction in the UI.
 * @param {tf.Tensor} outputTensor The output tensor from the model prediction.
 */
async function handlePrediction(outputTensor) {
  const requiredValues = 128 * 128;
  console.log("ttoto");
  let prediction = await outputTensor.data();
  console.log("titi");
  if (prediction.length < requiredValues) {
    // Ajouter des zéros pour atteindre le nombre requis de valeurs
    prediction = [
      ...prediction,
      ...Array(requiredValues - prediction.length).fill(0),
    ];
  } else if (prediction.length > requiredValues) {
    // Troncature des données pour correspondre au nombre requis de valeurs
    prediction = prediction.slice(0, requiredValues);
  }
  const highestPrediction = labels
    .map((label, index) => ({
      label: label,
      probability: prediction[index],
    }))
    .sort((a, b) => b.probability - a.probability)[0];

  outputTensor.dispose();
  return {
    label: highestPrediction.label,
    probability: highestPrediction.probability,
  };
}

/**
 * Orchestrates the loading, processing, and predicting of an audio file.
 */
async function loadAndPredict() {
  const fileInput = document.getElementById("audioUpload");
  const audioFile = fileInput.files[0];
  if (!audioFile) {
    console.log("Please upload an audio file.");
    return;
  }

  try {
    const startTime = performance.now();

    const audioBuffer = await decodeAudioFile(audioFile);
    const inputTensor = await processAudioBuffer(audioBuffer);
    const model = await loadModel();
    const outputTensor = await model.executeAsync(inputTensor);
    const result = await handlePrediction(outputTensor);

    const endTime = performance.now();
    const inferenceTime = endTime - startTime;

    document.getElementById("predictionOutput").textContent = `Prediction: ${
      result.label
    } with probability ${result.probability.toFixed(
      2
    )} in ${inferenceTime.toFixed(2)} ms`;
  } catch (error) {
    console.error("Error processing audio file:", error);
  }
}

module.exports = {
  loadAndPredict,
  getAudioContext,
  decodeAudioFile,
  processAudioBuffer,
  loadModel,
  handlePrediction,
  startAudioRecording,
  stopMediaRecording,
};

const labels = [
  "background_noise",
  "forward",
  "groovit",
  "happy",
  "nine",
  "surpuissant",
  "two",
  "visual",
  "yes",
];
