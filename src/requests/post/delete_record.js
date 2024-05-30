const fs = require("fs")
const url = require("url");
const mysql = require("mysql");
const config = require("../../config.json");
const static_tables = require("../../staticTables.json");
const client_styles = fs.readFileSync("src/client.css");
const client_script = fs.readFileSync("src/client.js").toString();
const session = require("express-session");

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
    website.post("/delete_record", (req, page) => {
      if (req.session.loggedin) {
        validate_mysql_obj(() => {
          database.query(
            `SELECT * FROM auth.permissions WHERE userId = ${req.session.userId}`,
            (err, permission, x) => {
              if (err) throw err;
              database.query(
                `SELECT * FROM auth.accounts WHERE ID = ${req.session.userId}`,
                (err, account, x) => {
                  if (err) throw err;
                  const record_information = url.parse(
                    req.rawHeaders[33],
                    true
                  ).query;
                  account = account[0];
                  account.permissions = permission;
                  const permissions = permissionsFor(
                    account,
                    record_information.db,
                    record_information.table
                  );
                  if (!permissions || permissions.canDelete == 1) {
                    const record_data = req.body;
                    if (record_data.ID != record_information.delete) {
                      page.send(
                        `<script>alert("You did not enter the correct ID"); history.back();</script>`
                      );
                      page.end();
                      return;
                    }
                    database.query(
                      `SELECT * FROM ${record_information.db}.${record_information.table} WHERE ID='${record_information.delete}'`,
                      (err, dataresult, datafields) => {
                        if (err) {
                          page.send(
                            `<script>alert("${err}"); history.back();</script>`
                          );
                          page.end();
                          return;
                        }
                        database.query(
                          `DELETE FROM ${record_information.db}.${record_information.table} WHERE ID='${record_information.delete}'`,
                          (err, result) => {
                            let final = `<title>Deletion Successful</title><script>${client_script}</script><style>${client_styles}</style>`;
                            if (err) {
                              page.send(
                                `<script>alert("${err}"); history.back();</script>`
                              );
                              page.end();
                              return;
                            }
                            database.query(
                              `INSERT INTO history.record_changes (\`accountID\`, \`username\`, \`type\`, \`recordID\`, \`ip\`, \`table\`, \`newData\`) VALUES ('${
                                req.session.userId
                              }', '${req.session.username}', 'DELETE', '${
                                dataresult[0].ID
                              }', '${req.ip}', '${record_information.db}.${
                                record_information.table
                              }', '${JSON.stringify(dataresult[0])}');`,
                              (err, results) => {
                                if (err) throw err;
                                final += `<h2>Successfully Deleted ID ${record_information.delete}</h2><form onsubmit="location.href = '/?db=${record_information.db}&table=${record_information.table}'; return false;"><input type="submit" value="Go Back"></form>`;
                                page.send(final);
                                page.end();
                              }
                            );
                          }
                        );
                      }
                    );
                  } else {
                    page.send(
                      `<script>alert("Access Denied"); history.back();</script>`
                    );
                    page.end();
                    return;
                  }
                }
              );
            }
          );
        }, static_tables.history.record_changes);
      } else {
        page.send(
          `<script>alert("Session Expired, Please Sign in Again."); window.location.pathname = "/";</script>`
        );
        page.end();
      }
    });
  },
};
