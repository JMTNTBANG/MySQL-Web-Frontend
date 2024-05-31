const fs = require("fs");
const url = require("url");
const mysql = require("mysql");
const config = require("../../config.json");
const static_tables = require("../../staticTables.json");
const session = require("express-session");

module.exports = {
  init: (prefix, website) => {
    if (!prefix) {
      prefix = "/"
    }
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
    function validate_mysql_obj(
      callback,
      data = { schema: "", table: "", columns: "" }
    ) {
      function create(skip_db = false) {
        function create_table() {
          database.query(
            `CREATE TABLE ${data.schema}.${data.table} (${data.columns});`,
            (err, result) => {
              if (err) throw err;
              callback();
            }
          );
        }
        if (!skip_db) {
          database.query(`CREATE SCHEMA ${data.schema};`, (err, result) => {
            if (err) throw err;
            create_table();
          });
        } else create_table();
      }
      database.query("SHOW SCHEMAS", (err, result, fields) => {
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
    website.use(
      session({ secret: "secret", resave: true, saveUninitialized: true })
    );
    website.post(`${prefix}save_record`, (req, page) => {
      if (req.session.dbloggedin) {
        validate_mysql_obj(() => {
          database.query(
            `SELECT * FROM auth.permissions WHERE userId = ${req.session.dbuserId}`,
            (err, permission, x) => {
              if (err) throw err;
              database.query(
                `SELECT * FROM auth.accounts WHERE ID = ${req.session.dbuserId}`,
                (err, account, x) => {
                  if (err) throw err;
                  account = account[0];
                  account.permissions = permission;
                  let type;
                  const record_information = url.parse(
                    req.rawHeaders[33],
                    true
                  ).query;
                  const record_data = req.body;
                  let changes = "";
                  const permissions = permissionsFor(
                    account,
                    record_information.db,
                    record_information.table
                  );
                  if (record_information.edit) {
                    if (!permissions || permissions.canEdit == 1) {
                      type = "EDIT";
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
                    } else {
                      page.send(
                        `<script>alert("Access Denied"); history.back();</script>`
                      );
                      page.end();
                      return;
                    }
                  } else if (record_information.create) {
                    if (!permissions || permissions.canCreate == 1) {
                      type = "CREATE";
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
                    } else {
                      page.send(
                        `<script>alert("Access Denied"); history.back();</script>`
                      );
                      page.end();
                      return;
                    }
                  }
                  database.query(changes, (err, result, fields) => {
                    if (err) {
                      page.send(
                        `<script>alert("${err}"); history.back();</script>`
                      );
                      page.end();
                      return;
                    }
                    let recordId = record_information.edit;
                    if (result.insertId > 0) recordId = result.insertId;
                    database.query(
                      `INSERT INTO history.record_changes (\`accountID\`, \`username\`, \`type\`, \`recordID\`, \`ip\`, \`table\`, \`newData\`) VALUES ('${
                        req.session.dbuserId
                      }', '${
                        req.session.dbusername
                      }', '${type}', '${recordId}', '${req.ip}', '${
                        record_information.db
                      }.${record_information.table}', '${JSON.stringify(
                        record_data
                      )}');`,
                      (err, results) => {
                        if (err) throw err;
                        page.redirect(
                          `${prefix}?db=${record_information.db}&table=${record_information.table}`
                        );
                        page.end();
                      }
                    );
                  });
                }
              );
            }
          );
        }, static_tables.history.record_changes);
      } else {
        page.send(
          `<script>alert("Session Expired, Please Sign in Again."); window.location.pathname = "${prefix}";</script>`
        );
        page.end();
      }
    });
  },
};
