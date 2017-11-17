/*jshint esversion: 6 */
/* global __dirname */

(function () {
  'use strict';

  const mongoose = require('mongoose');

  const userSchema = mongoose.Schema({
    name: String,
    phone: String,
    showName: Boolean
  });

  module.exports = mongoose.model('User', userSchema);

})();