/*jshint esversion: 6 */
/* global __dirname */

(function () {
  'use strict';

  const config = require('nconf');
  const request = require('request');
  const log = require('./logger.js');
  const player = require('play-sound')();
  const mongoose = require('mongoose');
  const User = require('./models/user');
  const modem = require('modem').Modem();
  const exec = require('child_process').exec;
  
  config.file({ file: 'config.json' });
  
  mongoose.connect('mongodb://localhost/doorlock');

  const numberSync = require('./schedulers/numberSync');
  numberSync.start();

  const sendPost = (url, userName) => {
    request({
      url: url,
      method: "POST",
      json: {"text":`Could not hold the door... ${userName} opened it!`}
    }, function(err, res, body) {
      //Do not care about the outcome
    });
  };

  const fireWebhooks = (userName) => {
    for(var i = 0, j = config.get('webhooks').length;i < j;i++){
      sendPost(config.get('webhooks')[i], userName);
      console.log('sending webhook to: '+config.get('webhooks')[i]);
    }
  };

  const openDoor = () => {
    const command = `/bin/bash ${config.get('openScript')}`;
    var child = exec(command);

    child.stdout.on('data', function(data) {
      console.log(data);
    });

    child.stderr.on('data', function(data) {
      console.error(data);
    });

    child.on('close', function(code) {
    });
  };

  modem.open(config.get('modem'), function() {
    console.log('connected to the device');
    modem.execute('AT+CVHU=0'); //enable to modem to hangup voice calls
    modem.execute('AT+CLIP=1'); //enable to modem to get extra info about the caller
  });
  
  modem.on('ring', function(number) {
    modem.execute('ATH'); //hangup when number has been received

    if (!number) {
      log.access.info('Denied access from caller with unknown number.');
      player.play('./sound/denied.mp3');

      return;
    }

    User.findOne({phone: number}, (err, user) => {
      if (err || !user) {
        player.play('./sound/denied.mp3');
        return;
      }

      player.play('./sound/granted.mp3');
      log.access.info('Granted access to '+user.name);
      let userDisplayName = user.showName ? user.name : 'Someone';
      fireWebhooks(userDisplayName);
      openDoor();
    });
  });

})();
