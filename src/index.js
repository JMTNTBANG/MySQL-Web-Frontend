var mysql = require('mysql');
var http = require('http');
var config = require('./config.json')

var database = mysql.createConnection({
  host: config.server.ip,
  port: config.server.port,
  user: config.auth.username,
  password: config.auth.password,
  database: config.database
});

database.connect(function(err) {
    if (err) throw err;
});

