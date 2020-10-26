'use strict';

function switchLabel(label) {

  const connectingLabel = document.getElementById('connecting');
  const connectedLabel = document.getElementById('connected');
  const disconnectedLabel = document.getElementById('disconnected');

  connectingLabel.hidden = true;
  connectedLabel.hidden = true;
  disconnectedLabel.hidden = true;

  document.getElementById(label).hidden = false;
}


function createStartStopButton(onStart, onStop) {
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');

  startButton.addEventListener('click', async () => {
    startButton.hidden = true;
    try {
      stopButton.hidden = false;
      switchLabel('connecting')
      await onStart();
    } catch (error) {

      switchLabel('disconnected')
      startButton.hidden = false;
      throw error;
    }
  });

  stopButton.addEventListener('click', async () => {
    stopButton.hidden = true;
    switchLabel('disconnected')
    try {
      startButton.hidden = false;
      await onStop();
    } catch (error) {
      stopButton.hidden = false;
      throw error;
    }
  });
}

module.exports = createStartStopButton;
