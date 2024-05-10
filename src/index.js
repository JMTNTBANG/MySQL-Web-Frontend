const mysql = require("mysql");
const url = require("url");
const config = require("./config.json");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const path = require("path");
const http = require("http");
const https = require("https");

const database = mysql.createConnection({
  host: config.server.ip,
  port: config.server.port,
  user: config.auth.username,
  password: config.auth.password,
});

database.connect(function (err) {
  if (err) throw err;
});

const client_script = fs.readFileSync("src/client.js").toString();
const client_styles = fs.readFileSync("src/client.css").toString();

function format(value) {
  let newValue = value;
  // Format DateTime Values
  try {
    newValue = value.toISOString().split("T").join(" ").slice(0, -5);
  } catch {}
  return newValue;
}

function validate_auth_schema(callback) {
  database.query("SHOW SCHEMAS", function (err, result, fields) {
    if (err) throw err;
    let auth = false;
    for (schema of result) {
      if (schema.Database == "auth") {
        auth = true;
      }
    }
    callback(auth);
  });
}

function gen_webpage(req, page) {
  const urlbar = url.parse(req.url, true);
  function get_db_data(callback) {
    database.query("SHOW SCHEMAS", function (err, result, fields) {
      let schemas = "";
      if (err) {
        page.send(`<script>alert("${err}"); history.back();</script>`);
        page.end();
        return;
      }
      schemas +=
        '<form onsubmit="db_submit(); return false;"><label for="db-sel">Database:</label> <select id="db-sel">';
      for (schema of result) {
        schemas += "<option";
        if (schema.Database == urlbar.query.db) schemas += " selected";
        schemas += ` value="${schema.Database}">${schema.Database}</option>`;
      }
      schemas += '</select> <input type="submit" value="Submit"></form>';
      database.query(
        `SHOW TABLES FROM ${urlbar.query.db}`,
        function (err, result, fields) {
          let tables = "";
          if (urlbar.query.db) {
            if (err) {
              page.send(`<script>alert("${err}"); history.back();</script>`);
              page.end();
              return;
            }
            tables +=
              '<form onsubmit="table_submit(); return false;"><label for="tabel-sel">Tables:</label> <select id="table-sel">';
            for (table of result) {
              tables += `<option`;
              if (table[`Tables_in_${urlbar.query.db}`] == urlbar.query.table)
                tables += " selected";
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
                  page.send(
                    `<script>alert("${err}"); history.back();</script>`
                  );
                  page.end();
                  return;
                }
                let exists = false;
                if (urlbar.query.edit) {
                  final += `<form action="/save_record" method="post"><input type="submit" value="Save">`;
                  let columns = [];
                  let rows = [];
                  for (column of fields) {
                    columns.push(
                      `<label for="${column.name}">${column.name}: </label>`
                    );
                    for (row of result) {
                      if (row["ID"] == urlbar.query.edit) {
                        exists = true;
                      }
                    }
                    if (!exists) {
                      page.send(
                        `<script>alert("Record Does not Exist in Table"); history.back();</script>`
                      );
                      page.end();
                      return;
                    }
                  }
                  for (row of result) {
                    if (row["ID"] == urlbar.query.edit) {
                      let current_column;
                      for (value in row) {
                        for (column of fields) {
                          if (column.name == value) {
                            current_column = column.name;
                          }
                        }
                        let val = row[value];
                        try {
                          val = val.toISOString();
                        } catch {}
                        rows.push(
                          `<input type="text" name="${current_column}" id="${current_column}" value="${format(
                            row[value]
                          )}">`
                        );
                      }
                    }
                  }
                  for (let i = 0; i < columns.length; i++) {
                    final += "<h3>" + columns[i] + rows[i] + "</h3>";
                  }
                } else if (urlbar.query.create) {
                  final += `<form action="/save_record" method="post"><input type="submit" value="Save">`;
                  for (column of fields) {
                    final += `<h3><label for="${column.name}">${column.name}: </label><input type="text" name="${column.name}" id="${column.name}"></h3>`;
                  }
                } else if (urlbar.query.delete) {
                  final += `<form action="/delete_record" method="post"><input type="number" name="ID" id="ID" required><input type="submit" value="Delete">`;
                } else {
                  final +=
                    '<table style="width:100%;"><tr><th><a onclick="record_create()" style="color: blue; cursor: pointer">Create</a></th>';
                  let searchbar =
                    '<div class="search"><form onsubmit="search_table(); return false;"><select id="search-column">';
                  for (column of fields) {
                    searchbar += `<option value="${column.name}">${column.name}</option>`;
                    if (urlbar.query.sortBy == column.name) {
                      if (urlbar.query.reversed == "false") {
                        final += `<th><a onclick="sort_by_column('${column.name}')" style="color: blue; cursor: pointer">${column.name}</a></th>`;
                      } else {
                        final += `<th><a onclick="sort_by_column('${column.name}')" style="color: red; cursor: pointer">${column.name}</a></th>`;
                      }
                    } else {
                      final += `<th><a onclick="sort_by_column('${column.name}')" style="cursor: pointer">${column.name}</a></th>`;
                    }
                  }
                  searchbar +=
                    '</select> <input type="text" name="Search" id="searchbar"> <input type="submit" value="Search"></div>';
                  final += `</tr>`;
                  if (urlbar.query.sortBy) {
                    if (urlbar.query.reversed == "false") {
                      result.sort((a, b) => {
                        if (a[urlbar.query.sortBy] > b[urlbar.query.sortBy]) {
                          return 1;
                        } else if (
                          a[urlbar.query.sortBy] < b[urlbar.query.sortBy]
                        ) {
                          return -1;
                        }
                        return 0;
                      });
                    } else {
                      result.sort((a, b) => {
                        if (a[urlbar.query.sortBy] < b[urlbar.query.sortBy]) {
                          return 1;
                        } else if (
                          a[urlbar.query.sortBy] > b[urlbar.query.sortBy]
                        ) {
                          return -1;
                        }
                        return 0;
                      });
                    }
                  }
                  for (row of result) {
                    if (urlbar.query.searchCol && urlbar.query.searchQuery) {
                      if (!row[urlbar.query.searchCol]) continue;
                      else if (
                        format(row[urlbar.query.searchCol])
                          .toString()
                          .includes(urlbar.query.searchQuery)
                      ) {
                      } else continue;
                    }
                    final += `<tr><td><a onclick="record_edit(${row["ID"]})" style="color: blue; cursor: pointer">Edit</a> <a onclick="record_delete(${row["ID"]})" style="color: red; cursor: pointer">Delete</a></td>`;
                    for (value in row) {
                      final += `<td>${format(row[value])}</td>`;
                    }
                    final += `</tr>`;
                  }
                  final += `</table>${searchbar}`;
                }
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
    let header = "<h1>Please Select a Database and Table:</h1>";
    let title = "Database Home";
    if (urlbar.search && urlbar.query.db && urlbar.query.table) {
      header = `<h1>Contents of ${urlbar.query.table} in ${urlbar.query.db}:</h1>`;
      title = `Contents of ${urlbar.query.table} in ${urlbar.query.db}`;
      if (urlbar.query.edit) {
        header = `<h1>Editing ID: ${urlbar.query.edit} of ${urlbar.query.table} in ${urlbar.query.db}:</h1>`;
        title = `Editing ID: ${urlbar.query.edit} of ${urlbar.query.table} in ${urlbar.query.db}`;
      } else if (urlbar.query.create) {
        header = `<h1>Creating Record in ${urlbar.query.table} in ${urlbar.query.db}:</h1>`;
        title = `Creating Record in ${urlbar.query.table} in ${urlbar.query.db}`;
      } else if (urlbar.query.delete) {
        header = `<h1>Please Confirm the ID of the Record you are deleting:</h1>`;
        title = `Deleting Record`;
      }
    }
    payload += `<title>${title}</title><script>${client_script}</script><style>${client_styles}</style>${header}`;
    if (urlbar.query.edit || urlbar.query.create || urlbar.query.delete) {
      payload += `${data.final}`;
    } else {
      payload += `${data.schemas}${data.tables}${data.final}<a class="logout" href="/logout">Logout</a>`;
    }
    page.send(payload);
    page.end();
  }
  get_db_data(gen_skeleton);
}

const app = express();
app.use(session({ secret: "secret", resave: true, saveUninitialized: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "static")));
app.get("/", function (request, response) {
  if (request.session.loggedin) {
    gen_webpage(request, response);
  } else {
    function callback(valid) {
      if (valid) {
        response.sendFile(path.join(__dirname + "/login.html"));
      } else {
        response.sendFile(path.join(__dirname + "/register.html"));
      }
    }
    validate_auth_schema(callback);
  }
});
app.post("/auth", function (request, response) {
  let username = request.body.username;
  let password = request.body.password;
  let previous_query = url.parse(request.rawHeaders[33], true).search;
  if (previous_query == null) {
    previous_query = "";
  }
  if (username && password) {
    database.query(
      "SELECT * FROM auth.accounts WHERE username = ? AND password = ?",
      [username, password],
      function (err, results, fields) {
        if (err) {
          response.send(`<script>alert("${err}"); history.back();</script>`);
          response.end();
          return;
        }
        if (results.length > 0) {
          request.session.loggedin = true;
          request.session.username = username;
        }
        response.redirect(`/${previous_query}`);
        response.end();
      }
    );
  }
});
app.post("/register", function (request, response) {
  function callback(valid) {
    if (valid) return;
    let username = request.body.username;
    let password = request.body.password;
    database.query("CREATE SCHEMA auth;", function (err, result) {
      if (err) {
        response.send(`<script>alert("${err}"); history.back();</script>`);
        response.end();
        return;
      }
      database.query(
        "CREATE TABLE auth.accounts (`ID` INT NOT NULL AUTO_INCREMENT, `username` VARCHAR(50) NOT NULL, `password` VARCHAR(255) NOT NULL, `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`ID`));",
        function (err, result) {
          if (err) {
            response.send(`<script>alert("${err}"); history.back();</script>`);
            response.end();
            return;
          }
          database.query(
            `INSERT INTO auth.accounts (\`username\`, \`password\`) VALUES ('${username}', '${password}');`,
            function (err, result) {
              if (err) {
                response.send(
                  `<script>alert("${err}"); history.back();</script>`
                );
                response.end();
                return;
              }
              response.redirect("/");
            }
          );
        }
      );
    });
  }
  validate_auth_schema(callback);
});
app.post("/save_record", function (request, response) {
  const record_information = url.parse(request.rawHeaders[33], true).query;
  const record_data = request.body;
  let changes = "";
  if (record_information.edit) {
    changes = `UPDATE ${record_information.db}.${record_information.table} SET `;
    let first = true;
    for (column in record_data) {
      let text = `'${record_data[column]}'`;
      if (text == "'null'") {
        text = "null";
      }
      if (first) {
        changes += `\`${column}\` = ${text}`;
        first = false;
      } else {
        changes += `, \`${column}\` = ${text}`;
      }
    }
    changes += ` WHERE (\`ID\` = '${record_information.edit}');`;
  } else if (record_information.create) {
    let columns = "";
    let values = "";
    let first = true;
    for (column in record_data) {
      let text = `'${record_data[column]}'`;
      if (text == "'null'") {
        text = "null";
      }
      if (text != "''") {
        if (first) {
          columns += `\`${column}\``;
          values += `${text}`;
          first = false;
        } else {
          columns += `, \`${column}\``;
          values += `, ${text}`;
        }
      }
      changes = `INSERT INTO ${record_information.db}.${record_information.table} (${columns}) VALUES (${values});`;
    }
  }
  database.query(changes, function (err, result, fields) {
    if (err) {
      response.send(`<script>alert("${err}"); history.back();</script>`);
      response.end();
      return;
    }
    response.redirect(
      `/?db=${record_information.db}&table=${record_information.table}`
    );
    response.end();
  });
});
app.post("/delete_record", function (request, response) {
  const record_information = url.parse(request.rawHeaders[33], true).query;
  const record_data = request.body;
  if (record_data.ID != record_information.delete) {
    response.send(
      `<script>alert("You did not enter the correct ID"); history.back();</script>`
    );
    response.end();
    return;
  }
  database.query(
    `DELETE FROM ${record_information.db}.${record_information.table} WHERE ID='${record_information.delete}'`,
    function (err, result) {
      let final = `<title>Deletion Successful</title><script>${client_script}</script><style>${client_styles}</style>`;
      if (err) {
        response.send(`<script>alert("${err}"); history.back();</script>`);
        response.end();
        return;
      }
      final += `<h2>Successfully Deleted ID ${record_information.delete}</h2><form onsubmit="location.href = '/?db=${record_information.db}&table=${record_information.table}'; return false;"><input type="submit" value="Go Back"></form>`;
      response.send(final);
      response.end();
    }
  );
});
app.get("/logout", function (request, response) {
  if (request.session.loggedin) {
    request.session.loggedin = false;
  }
  response.redirect("/");
});
const httpServer = http.createServer(app);
httpServer.listen(8080, () => {
  console.log("HTTP Server running on port 80");
});

try {
  https
    .createServer(
      {
        key: fs.readFileSync(`${config.ssl}/privkey.pem`, "utf8"),
        cert: fs.readFileSync(`${config.ssl}/cert.pem`, "utf8"),
        ca: fs.readFileSync(`${config.ssl}/chain.pem`, "utf8"),
      },
      app
    )
    .listen(443, () => {
      console.log("HTTPS Server running on port 443");
    });
} catch {
  console.log("Caution: Connections will not be secured");
}
