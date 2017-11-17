/*jshint esversion: 6 */
/* global __dirname, Promise */

(function () {
  'use strict';

  const config = require('nconf');
  const XLSX = require('xlsx');
  const mongoose = require('mongoose');
  const User = require('../models/user');
  const casper_nodejs = require('casper-nodejs');  
  const casper = casper_nodejs.create(config.get('sync:loginurl'), {});
  
  const getStringValue = (cell, row, worksheet) => {
    if (worksheet[XLSX.utils.encode_cell({ c: cell, r: row })] && worksheet[XLSX.utils.encode_cell({ c: cell, r: row })].v) {
      return worksheet[XLSX.utils.encode_cell({ c: cell, r: row })].v;
    }
    
    return null;
  };
  
  const getBooleanValue = (cell, row, worksheet) => {
    const stringValue = getStringValue(cell, row, worksheet);

    if (!stringValue) {
      return false;
    }
    
    return stringValue.replace(/ /g, '') === 'X';
  };

  const getPhoneValue = (cell, row, worksheet) => {
    let stringValue = getStringValue(cell, row, worksheet);
    if (!stringValue) {
      return null;
    }
    
    stringValue = stringValue.replace(/ /g, '');
    if (stringValue.startsWith('0')) {
      stringValue = '+358' + stringValue.substring(1);
    }
    
    return stringValue ? stringValue : null;
  };
  
  const synchronize = () => {
    
    casper.then([function (settings) {
      this.open(settings.loginurl);
    }, [config.get('sync')]], (ret) => {
      console.log('Login page opened');
    });
    
    casper.then([function (settings) {
      this.fillSelectors('form[name="login"]', {
        '#u_id': settings.username,
        '#u_password': settings.password
      }, true);
    }, [config.get('sync')]], (ret) => {
      console.log('form filled');
    });

    casper.then([function (settings) {
      this.download(settings.exporturl, 'data.xlsx');
    }, [config.get('sync')]], (ret) => {
      console.log('File downloaded');
    });

    casper.then(function () {
      const workbook = XLSX.readFile('data.xlsx');
      const sheetName = Object.keys(workbook.Sheets)[0];
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const results = [];

      for (let row = 1; row <= range.e.r; row++) {
        let phone = getPhoneValue(4, row, worksheet);

        if(!phone) {
          continue;
        }

        let monthlyUser20 = getBooleanValue(8, row, worksheet);
        let monthlyUser40 = getBooleanValue(9, row, worksheet);
        let userBanned = getBooleanValue(12, row, worksheet);

        if ((!monthlyUser20 && !monthlyUser40) || userBanned) {
          continue;
        }

        let fname = getStringValue(0, row, worksheet);
        let lname = getStringValue(1, row, worksheet);

        let showName = getBooleanValue(11, row, worksheet);

        results.push({
          name: `${fname} ${lname}`,
          phone: phone,
          showName: showName
        });
      }

      User.remove({}, () => {
        console.log('Old users removed');
        const userCreatePromises = [];
        for (let i = 0; i < results.length; i++) {
          let user = new User();
          user.name = results[i].name;
          user.phone = results[i].phone;
          user.showName = results[i].showName;
          userCreatePromises.push(user.save());
        }

        Promise.all(userCreatePromises)
          .then(() => {
            console.log('users imported');
          })
          .catch((err) => {
            console.log(err);
          });
      });
    });
    
    casper.then([function (settings) {
      this.open(settings.logouturl);
    }, [config.get('sync')]], (ret) => {
      console.log('Logged out');
    });
    
    casper.run();
  };

  module.exports = {
    start: () => {
      synchronize();
      setInterval(() => {
        console.log('Synchonizing');
        synchronize();
      }, 1000 * 60 * 60 * 6);
    }
  };

})();