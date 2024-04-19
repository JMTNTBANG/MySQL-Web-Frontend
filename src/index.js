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

http.createServer(function (req, page) {
    database.query(`SELECT * FROM ${config.table}`, function (err, result, fields) {
        if (err) throw err;
        var text = `Contents of ${config.table}: \n`
        for (column of fields) {
            text += `${column.name}: ${result[0][column.name]}\n`
        }
        page.write(text);
        page.end();
    });
}).listen(8080);