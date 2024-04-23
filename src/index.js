var mysql = require("mysql");
var http = require("http");
var url = require("url");
var config = require("./config.json");

var database = mysql.createConnection({
  host: config.server.ip,
  port: config.server.port,
  user: config.auth.username,
  password: config.auth.password,
});

database.connect(function (err) {
  if (err) throw err;
});

function gen_webpage(req, page) {
  const urlbar = url.parse(req.url, true);
  function get_db_data(callback) {
    database.query("SHOW SCHEMAS", function (err, result, fields) {
      let schemas = "";
      if (err) {
        page.write(`${err}`)
        page.end()
        return;
      }
      schemas += '<form><label for="db-sel">Database:</label> <select id="db-sel">';
      for (schema of result) {
        schemas += '<option'
        if (schema.Database == urlbar.query.db) schemas += " selected";
        schemas += `>${schema.Database}</option>`;
      }
      schemas += '</select> <input type="submit" value="Submit"></form>';
      database.query(
        `SHOW TABLES FROM ${urlbar.query.db}`,
        function (err, result, fields) {
          let tables = "";
          if (urlbar.query.db) {
            if (err) {
              page.write(`${err}`)
              page.end()
              return;
            }
            tables += '<form><label for="tabel-sel">Tables:</label> <select id="table-sel">';
            for (table of result) {
              tables += `<option`
              if (table[`Tables_in_${urlbar.query.db}`] == urlbar.query.table) tables += " selected";
              tables += `>${table[`Tables_in_${urlbar.query.db}`]}</option>`;
            }
            tables += '</select> <input type="submit" value="Submit"></form>';
          }
          database.query(
            `SELECT * FROM ${urlbar.query.db}.${urlbar.query.table}`,
            function (err, result, fields) {
              let final = "";
              if (urlbar.query.db && urlbar.query.table) {
                if (err) {
                  page.write(`${err}`)
                  page.end()
                  return;
                }
                final += '<table style="width:100%;"><tr>';
                for (column of fields) {
                  final += `<th>${column.name}</th>`;
                }
                final += `</tr>`;
                for (row of result) {
                  final += `<tr>`;
                  for (value in row) {
                    final += `<td>${row[value]}</td>`;
                  }
                  final += `</tr>`;
                }
                final += `</table>`;
              }
              callback({ schemas: schemas, tables: tables, final: final });
            }
          );
        }
      );
    });
  }
  function gen_skeleton(data) {
    let payload = "";
    if (urlbar.pathname == "/home.html") {
      let header = "<h1>Please Select a Database and Table:</h1>";
      if (urlbar.search && urlbar.query.db && urlbar.query.table) {
        header = `<h1>Contents of ${urlbar.query.table} in ${urlbar.query.db}:</h1>`;
      }
      payload += `<style>table, th, td {border:1px solid black;}</style>${header}${data.schemas}${data.tables}${data.final}`;
      page.write(payload);
      page.end();
    }
  }
  get_db_data(gen_skeleton);
}

http.createServer(gen_webpage).listen(8080);
