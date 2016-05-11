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
const upload = multer({ dest: 'uploads/' });
const app = express();
const port = 9745;

const say = require('say');
const child_process = require('child_process');

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

  say.export(req.query.say, 'Victoria', 1.0, 'audio/' + fileId + '.wav', function(err) {
    if (err) {
      return console.error(err);
    }

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
              console.log('Sent:', fileName);
            }
          });
        }
        
      }
    );
  });

});

app.post('/audio', upload.single('data'), (req, res) => {
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
