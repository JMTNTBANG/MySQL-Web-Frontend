var mysql = require("mysql");
var http = require("http");
var config = require("./config.json");

var database = mysql.createConnection({
  host: config.server.ip,
  port: config.server.port,
  user: config.auth.username,
  password: config.auth.password,
  database: config.database,
});

database.connect(function (err) {
  if (err) throw err;
});

http
  .createServer(function (req, page) {
    database.query(
      `SELECT * FROM ${config.table}`,
      function (err, result, fields) {
        if (err) throw err;
        var text = `<style>table, th, td {border:1px solid black;}</style><h1>Contents of ${config.table}:</h1><table style="width:100%;"><tr>`;
        for (column of fields) {
          text += `<th>${column.name}</th>`;
        }
        text += `</tr>`;
        for (row of result) {
          text += `<tr>`;
          for (value in row) {
            text += `<td>${row[value]}</td>`;
          }
          text += `</tr>`;
        }
        text += `</table>`;
        page.write(text);
        page.end();
      }
    );
  })
  .listen(8080);
