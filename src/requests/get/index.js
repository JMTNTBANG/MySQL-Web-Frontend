const fs = require("fs");
const url = require("url");
const mysql = require("mysql");
const config = require("../../config.json");
const static_tables = require("../../staticTables.json")
const client_styles = fs.readFileSync("src/client.css");
const client_script = fs.readFileSync("src/client.js").toString();

module.exports = {
  init: (website) => {
    // Database
    const database = mysql.createConnection({
      host: config.server.ip,
      port: config.server.port,
      user: config.auth.username,
      password: config.auth.password,
    });
    // .connect((err) => {
    //   if (err) throw err;
    //   console.log(
    //     `Connected to MySQL Database at '${config.auth.username}@${config.server.ip}:${config.server.port}'`
    //   );
    // });
    function validate_auth_schema(callback) {
      database.query("SHOW SCHEMAS", (err, result, fields) => {
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

    function validate_mysql_obj(
      callback,
      data = { schema: "", table: "", columns: "" }
    ) {
      function create(skip_db = false) {
        function create_table() {
          database.query(
            `CREATE TABLE ${data.schema}.${data.table} (${data.columns});`,
            function (err, result) {
              if (err) throw err;
              callback();
            }
          );
        }
        if (!skip_db) {
          database.query(
            `CREATE SCHEMA ${data.schema};`,
            function (err, result) {
              if (err) throw err;
              create_table();
            }
          );
        } else create_table();
      }
      database.query("SHOW SCHEMAS", function (err, result, fields) {
        if (err) throw err;
        let schema_exists = false;
        for (schemas of result) {
          if (schemas.Database == data.schema) {
            schema_exists = true;
          }
        }
        if (!schema_exists) create();
        else
          database.query(
            `SHOW TABLES FROM ${data.schema}`,
            (err, result, fields) => {
              if (err) throw err;
              let table_exists = false;
              for (tables of result) {
                if (tables[`Tables_in_${data.schema}`] == data.table) {
                  table_exists = true;
                }
              }
              if (!table_exists) create(true);
              else callback();
              return;
            }
          );
      });
    }

    function format(value) {
      let newValue = value;
      // Format DateTime Values
      try {
        newValue = value.toISOString().split("T").join(" ").slice(0, -5);
      } catch {}
      return newValue;
    }

    function permissionsFor(user, schema, table = undefined) {
      for (permission of user.permissions) {
        if (permission.schema == schema) {
          if (!table || permission.table == table || permission.table == "*") {
            return {
              canView: permission.canView,
              canCreate: permission.canCreate,
              canEdit: permission.canEdit,
              canDelete: permission.canDelete,
            };
          } else continue;
        } else continue;
      }
      if (user.admin == 1)
        return {
          canView: 1,
          canCreate: 1,
          canEdit: 1,
          canDelete: 1,
        };
      return null;
    }
    website.get("/", (req, page) => {
      const query = url.parse(req.url, true).query;
      if (req.session.loggedin) {
        validate_mysql_obj(() => {
          database.query(
            `SELECT * FROM auth.permissions WHERE userId = ${req.session.userId}`,
            (err, permissions, x) => {
              if (err) throw err;
              database.query(
                `SELECT * FROM auth.accounts WHERE ID = ${req.session.userId}`,
                (err, account, x) => {
                  if (err) throw err;
                  account = account[0];
                  account.permissions = permissions;
                  database.query(
                    "SHOW SCHEMAS",
                    function (err, result, fields) {
                      let schemas = "";
                      if (err) {
                        page.send(
                          `<script>alert("${err}"); history.back();</script>`
                        );
                        page.end();
                        return;
                      }
                      schemas +=
                        '<form onsubmit="db_submit(); return false;"><label for="db-sel">Database:</label> <select id="db-sel">';
                      for (schema of result) {
                        const permissions = permissionsFor(
                          account,
                          schema.Database
                        );
                        if (!permissions || permissions.canView == 0) continue;
                        schemas += "<option";
                        if (schema.Database == query.db) schemas += " selected";
                        schemas += ` value="${schema.Database}">${schema.Database}</option>`;
                      }
                      schemas +=
                        '</select> <input type="submit" value="Submit"></form>';
                      database.query(
                        `SHOW TABLES FROM ${query.db}`,
                        function (err, result, fields) {
                          let tables = "";
                          if (query.db) {
                            if (err) {
                              page.send(
                                `<script>alert("${err}"); history.back();</script>`
                              );
                              page.end();
                              return;
                            }
                            tables +=
                              '<form onsubmit="table_submit(); return false;"><label for="tabel-sel">Tables:</label> <select id="table-sel">';
                            for (table of result) {
                              const permissions = permissionsFor(
                                account,
                                query.db,
                                table[`Tables_in_${query.db}`]
                              );
                              if (!permissions || permissions.canView == 0)
                                continue;
                              tables += `<option`;
                              if (table[`Tables_in_${query.db}`] == query.table)
                                tables += " selected";
                              tables += `>${
                                table[`Tables_in_${query.db}`]
                              }</option>`;
                            }
                            tables +=
                              '</select> <input type="submit" value="Submit"></form>';
                          }
                          database.query(
                            `SELECT * FROM ${query.db}.${query.table}`,
                            function (err, result, fields) {
                              let final = "";
                              if (query.db && query.table) {
                                if (err) {
                                  page.send(
                                    `<script>alert("${err}"); history.back();</script>`
                                  );
                                  page.end();
                                  return;
                                }
                                let exists = false;
                                if (query.edit) {
                                  final += `<form action="/save_record" method="post"><input type="submit" value="Save">`;
                                  let columns = [];
                                  let rows = [];
                                  for (column of fields) {
                                    columns.push(
                                      `<label for="${column.name}">${column.name}: </label>`
                                    );
                                    for (row of result) {
                                      if (row["ID"] == query.edit) {
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
                                    if (row["ID"] == query.edit) {
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
                                    final +=
                                      "<h3>" + columns[i] + rows[i] + "</h3>";
                                  }
                                } else if (query.create) {
                                  final += `<form action="/save_record" method="post"><input type="submit" value="Save">`;
                                  for (column of fields) {
                                    final += `<h3><label for="${column.name}">${column.name}: </label><input type="text" name="${column.name}" id="${column.name}"></h3>`;
                                  }
                                } else if (query.delete) {
                                  final += `<form action="/delete_record" method="post"><input type="number" name="ID" id="ID" required><input type="submit" value="Delete">`;
                                } else {
                                  final +=
                                    '<table style="width:100%;"><tr><th>';
                                  const permissions = permissionsFor(
                                    account,
                                    query.db,
                                    query.table
                                  );
                                  if (
                                    !permissions ||
                                    permissions.canCreate == 1
                                  ) {
                                    final +=
                                      '<a onclick="record_create()" style="color: blue; cursor: pointer">Create</a>';
                                  }
                                  final += "</th>";
                                  let searchbar =
                                    '<div class="search"><form onsubmit="search_table(); return false;"><select id="search-column">';
                                  for (column of fields) {
                                    searchbar += `<option value="${column.name}">${column.name}</option>`;
                                    if (query.sortBy == column.name) {
                                      if (query.reversed == "false") {
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
                                  if (query.sortBy) {
                                    if (query.reversed == "false") {
                                      result.sort((a, b) => {
                                        if (a[query.sortBy] > b[query.sortBy]) {
                                          return 1;
                                        } else if (
                                          a[query.sortBy] < b[query.sortBy]
                                        ) {
                                          return -1;
                                        }
                                        return 0;
                                      });
                                    } else {
                                      result.sort((a, b) => {
                                        if (a[query.sortBy] < b[query.sortBy]) {
                                          return 1;
                                        } else if (
                                          a[query.sortBy] > b[query.sortBy]
                                        ) {
                                          return -1;
                                        }
                                        return 0;
                                      });
                                    }
                                  }
                                  for (row of result) {
                                    if (query.searchCol && query.searchQuery) {
                                      if (!row[query.searchCol]) continue;
                                      else if (
                                        format(row[query.searchCol])
                                          .toString()
                                          .includes(query.searchQuery)
                                      ) {
                                      } else continue;
                                    }
                                    final += `<tr><td style="width: 75px"> `;
                                    const permissions = permissionsFor(
                                      account,
                                      query.db,
                                      query.table
                                    );
                                    if (
                                      !permissions ||
                                      permissions.canEdit == 1
                                    ) {
                                      final += `<a onclick="record_edit(${row["ID"]})" style="color: blue; cursor: pointer">Edit</a> `;
                                    }
                                    if (
                                      !permissions ||
                                      permissions.canDelete == 1
                                    ) {
                                      final += `<a onclick="record_delete(${row["ID"]})" style="color: red; cursor: pointer">Delete</a>`;
                                    }

                                    final += "</td>";
                                    for (value in row) {
                                      final += `<td>${format(row[value])}</td>`;
                                    }
                                    final += `</tr>`;
                                  }
                                  final += `</table>${searchbar}`;
                                }
                              }
                              let payload = "";
                              let header =
                                "<h1>Please Select a Database and Table:</h1>";
                              let title = "Database Home";
                              if (query.db && query.table) {
                                header = `<h1>Contents of ${query.table} in ${query.db}:</h1>`;
                                title = `Contents of ${query.table} in ${query.db}`;
                                if (query.edit) {
                                  header = `<h1>Editing ID: ${query.edit} of ${query.table} in ${query.db}:</h1>`;
                                  title = `Editing ID: ${query.edit} of ${query.table} in ${query.db}`;
                                } else if (query.create) {
                                  header = `<h1>Creating Record in ${query.table} in ${query.db}:</h1>`;
                                  title = `Creating Record in ${query.table} in ${query.db}`;
                                } else if (query.delete) {
                                  header = `<h1>Please Confirm the ID of the Record you are deleting:</h1>`;
                                  title = `Deleting Record`;
                                }
                              }
                              payload += `<title>${title}</title><script>${client_script}</script><style>${client_styles}</style>${header}`;
                              if (query.edit || query.create || query.delete) {
                                payload += `${final}`;
                              } else {
                                payload += `${schemas}${tables}${final}<a class="logout" href="/logout">Logout</a>`;
                              }
                              page.send(payload);
                              page.end();
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }, static_tables.auth.permissions);
      } else {
        validate_auth_schema((valid) => {
          if (valid) {
            page.sendFile(`${__dirname.slice(0, -13)}/login.html`);
          } else {
            page.sendFile(`${__dirname.slice(0, -13)}/register.html`);
          }
        });
      }
    });
  },
};
