const https = require('https');
const fs = require('fs');
const request = require('request');

const options = {
  // Private Key
  key: fs.readFileSync('./ssl/server.key'),

  // SSL Certficate
  cert: fs.readFileSync('./ssl/server.crt'),

  // Make sure an error is not emitted on connection when the server certificate verification against the list of supplied CAs fails.
  rejectUnauthorized: false
};

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const qs = require('qs');
const multer  = require('multer');
//const upload = multer({ dest: 'uploads/' });

var timeStamp = Date.now();

var questionText ="";

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + timeStamp + '.wav')
  }
})

var upload = multer({ storage: storage })

const app = express();
const port = 9745;

const say = require('say');
const child_process = require('child_process');
//const google_speech = require('google-speech');

var watson = require('watson-developer-cloud');

var watson_stt = watson.speech_to_text({
  username: '',
  password: '',
  version: 'v1'
});

var watson_tts = watson.text_to_speech({
  username: '',
  password: '',
  version: 'v1'
});

const server = https.createServer(options, app).listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});

app.use(bodyParser.urlencoded({ extended: true}))
app.use(bodyParser.json());
app.use(cors());

app.use('/', express.static(__dirname));

app.get('/authresponse', (req, res) => {
  res.redirect(301, `/?${qs.stringify(req.query)}`);
});

app.get('/text2audio', (req, res) => {

  var fileId = new Date().valueOf();
  timeStamp = Date.now();

  questionText = req.query.text;

  var watson_params = {
            // URL of the resource you wish to access
            text: req.query.text,
            voice: 'en-US_AllisonVoice',
            accept: 'audio/wav'
          };

  //var transcript = watson_tts.synthesize(req.query);
  var transcript = watson_tts.synthesize(watson_params).pipe(fs.createWriteStream('audio/' + fileId + '.wav'));

  transcript.on('finish', function(response) {
    console.log('Text has been saved to audio/' + fileId + '.wav.');

    child_process.execFile(
      'ffmpeg',
      [
      "-i", "audio/" + fileId + ".wav",
      "-ar", "16000",
      "audio/" + fileId + "-16k.wav"
      ],
      {
        cwd: "."
      },
      (err, stdout, stderr) => {
        if (err) {
          console.log('ffmpegProcess Error: ' + err);
        }
        else {
          console.log('ffmpegProcess Success: ' + stdout);

          //downsample wav file to 16 bit
          var options = {
            root: __dirname + '/audio/',
            dotfiles: 'deny',
            headers: {
              'x-timestamp': Date.now(),
              'x-sent': true,
              'Content-Type': 'audio/x-wav'
            }
          };

          var fileName = fileId + '-16k.wav';
          res.sendFile(fileName, options, function (err) {
            if (err) {
              console.log(err);
              res.status(err.status).end();
            }
            else {
              res.json();
              console.log('Sent:', fileName);
            }
          });
        }
        
      });
    
  });
  transcript.on('error', function(error) {
    return console.error(err);
  });

  // say.export(req.query.say, 'Victoria', 1.0, 'audio/' + fileId + '.wav', function(err) {
  //   if (err) {
  //     return console.error(err);
  //   }

  //   });

});

app.post('/audio2text', upload.single('file'), (req, res) => {

  _res = res;

  child_process.execFile(
    'ffmpeg',
    [
    "-i", "uploads/file-" + timeStamp + ".wav",
    "-ar", "16000",
    "uploads/file-" + timeStamp + "-16k.wav"
    ],
    {
      cwd: "."
    },
    (err, stdout, stderr) => {
      if (err) {
        console.log('ffmpegProcess Error: ' + err);
      }
      else {
        console.log('ffmpegProcess Success: ' + stdout);

        var watson_params = {
            // URL of the resource you wish to access
            audio: fs.createReadStream("uploads/file-" + timeStamp + "-16k.wav"),
            content_type: 'audio/wav; rate=44100'
          };

          watson_stt.recognize(watson_params, function(err, res) {
            if (err) {
              console.log(err);
            }
            else {
              var text = res.results[0].alternatives[0].transcript;
              console.log("transcript: " + text);

              //build up response
              //var result = '{ "question": "' + questionText +'", "answer": "' + text + '"}';
              var result = { "question": questionText, "answer": text };
              _res.json(result);
            }
          });

          
        }
        
      }
      );
});

app.post('/audio', upload.single('file'), (req, res) => {
  res.json(req.file);
});

app.get('/parse-m3u', (req, res) => {
  const m3uUrl = req.query.url;
  console.log(m3uUrl)

  if (!m3uUrl) {
    return res.json([]);
  }

  const urls = [];

  request(m3uUrl, function(error, response, bodyResponse) {
    console.log(bodyResponse, m3uUrl)
    if (bodyResponse) {
      urls.push(bodyResponse);
    }

    res.json(urls);
  });
});
