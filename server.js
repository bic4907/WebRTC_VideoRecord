'use strict';

const { PassThrough } = require('stream')
const fs = require('fs')
let moment = require('moment');


const { RTCAudioSink, RTCVideoSink } = require('wrtc').nonstandard;

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const { StreamInput } = require('fluent-ffmpeg-multistream')

const { v4: uuidv4 } = require('uuid');

const VIDEO_OUTPUT_SIZE = '640x480'
const VIDEO_DIR = './videos'

function beforeOffer(peerConnection) {
    const dataChannel = peerConnection.createDataChannel('health-check');
    let lastHealth = null
    let healthCheckItv = null

    peerConnection.uuid = uuidv4()

    const VIDEO_FILENAME = VIDEO_DIR + '/' + peerConnection.uuid + '.mp4'

    const audioTransceiver = peerConnection.addTransceiver('audio');
    const videoTransceiver = peerConnection.addTransceiver('video');

    const audioSink = new RTCAudioSink(audioTransceiver.receiver.track);
    const videoSink = new RTCVideoSink(videoTransceiver.receiver.track);

    const streams = [];

    videoSink.addEventListener('frame', ({ frame: { width, height, data }}) => {
        const size = width + 'x' + height;

        if(size != VIDEO_OUTPUT_SIZE) {
            return;
        }


        if (!streams[0] || (streams[0] && streams[0].size !== size)) {

            dataChannel.send('video-ok')

            healthCheckItv = setInterval(function() {
                if(lastHealth != null && moment().valueOf() - lastHealth > 3000) {
                    console.log(peerConnection.uuid, ' - Timeout!')
                    peerConnection.close()
                    lastHealth = null
                }
            })



            const stream = {
                recordPath: VIDEO_FILENAME,
                size,
                video: new PassThrough(),
                audio: new PassThrough()
            };

            const onAudioData = ({ samples: { buffer } }) => {
                if (!stream.end) {
                    stream.audio.push(Buffer.from(buffer));
                }
            };

            audioSink.addEventListener('data', onAudioData);

            stream.audio.on('end', () => {
                audioSink.removeEventListener('data', onAudioData);
            });

            streams.unshift(stream);

            streams.forEach(item => {
                if (item !== stream && !item.end) {
                    item.end = true;
                    if (item.audio) {
                        item.audio.end();
                    }
                    item.video.end();
                }
            })

            stream.proc = ffmpeg()
                .addInput((new StreamInput(stream.video)).url)
                .addInputOptions([
                    '-f', 'rawvideo',
                    '-pix_fmt', 'yuv420p',
                    '-s', stream.size,
                    '-r', '30',
                ])
                .addInput((new StreamInput(stream.audio)).url)
                .addInputOptions([
                    '-f s16le',
                    '-ar 48k',
                    '-ac 1',
                ])
                .on('start', ()=>{
                    console.log(peerConnection.uuid, 'Start recording >> ', stream.recordPath)
                })
                .on('end', ()=>{
                    stream.recordEnd = true;
                    console.log(peerConnection.uuid, 'Stop recording >> ', stream.recordPath)
                })
                .size(VIDEO_OUTPUT_SIZE)
                .output(stream.recordPath);

            stream.proc.run();
        }

        if(streams.length) {
            streams[0].video.push(Buffer.from(data));
        }
    });

    const { close } = peerConnection;
    peerConnection.close = function() {
        audioSink.stop();
        videoSink.stop();

        streams.forEach(({ audio, video, end, proc, recordPath })=>{
            if (!end) {
                if (audio) {
                    audio.end();
                }
                video.end();
            }
        });

        /*
        let totalEnd = 0;
        const timer = setInterval(()=>{
          streams.forEach(stream=>{
            if (stream.recordEnd) {
              totalEnd++;
              if (totalEnd === streams.length) {
                clearTimeout(timer);

                const mergeProc = ffmpeg()
                  .on('start', ()=>{
                    console.log('Start merging into ' + VIDEO_FILENAME);
                  })
                  .on('end', ()=>{
                    streams.forEach(({ recordPath })=>{
                      fs.unlinkSync(recordPath);
                    })
                    console.log('Merge end. You can play ' + VIDEO_FILENAME);
                  });

                streams.forEach(({ recordPath })=>{
                  mergeProc.addInput(recordPath)
                });

                mergeProc
                  .output(VIDEO_DIR + '/' + peerConnection.uuid + '.mp4')
                  .run();
              }
            }
          });
        }, 1000)
        */
        return close.apply(this, arguments);

        dataChannel.removeEventListener('message', onMessage);
        dataChannel.close();
        clearInterval(healthCheckItv)
    }

    function onMessage({ data }) {
        dataChannel.send(data);
        lastHealth = moment().valueOf()
    }



    dataChannel.addEventListener('message', onMessage);

}

module.exports = { beforeOffer };
