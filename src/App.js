import "./App.css";
import React, { useState } from "react";
const kws = require("./kws-utils");

function App() {
  const [toggled, setToggled] = useState(false);

  const handleButtonClick = () => {
    setToggled(true);
    kws.startAudioRecording();
    setTimeout(() => {
      kws.stopMediaRecording();
      setToggled(false);
    }, 1000);
  };

  return (
    <div className="App container">
      <header className="text-white text-center py-3">
        <img
          src={`${process.env.PUBLIC_URL}/assets/logo.svg`}
          alt="logo"
          className="logo"
        />
      </header>

      <main className="d-flex flex-column align-items-center my-5">
        <audio id="audioPlayback" controls className="mb-3"></audio>

        <button
          type="button"
          id="buttonRec"
          className="btn btn-primary btn-lg"
          onClick={handleButtonClick}
        >
          {toggled ? "Stop" : "Record"}
        </button>

        <textarea
          id="text"
          className="form-control mt-4"
          rows="5"
          placeholder="Transcription will appear here..."
        ></textarea>
      </main>

      <footer className="text-white text-center py-3 mt-auto">
        <p>&copy; 2024 démonstration du KWS par SurPuissant.</p>
      </footer>
    </div>
  );
}

export default App;
