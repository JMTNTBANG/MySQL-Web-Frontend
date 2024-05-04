# MySQL Web Frontend
A Web Interface for a MySQL Server

## Setup
### Initial
1. Install Dependencies with `npm i`
2. Create `src/config.json`
3. Add the Following Data into `config.json`
```json
{
  "ssl": "/etc/letsencrypt/live/[YOUR DOMAIN NAME]",
  "server": {
    "ip": "[MYSQL IP ADDRESS]",
    "port": "3306"
  },
  "auth": {
    "username": "[MYSQL USERNAME]",
    "password": "[MYSQL PASSWORD]"
  }
}
```
`ssl`: The location of your SSL Certificates in your server

`server.ip`: The IP Address to your MySQL Server

`server.port`: The Access Port to your MySQL Server (usually 3306)

`auth.username`: The Username to access your MySQL Server

`auth.password`: The Password to access your MySQL Server

**Make sure the MySQL User has at least `ALTER`, `CREATE`, `DELETE`, `INSERT`, `SELECT`, and `UPDATE` privileges to the Databases you want accessible through the web interface**

***Also Ensure that each database has a Primary Key Column named ID or most of the features will not work***

### Logging into the Web Interface
Send the follwing queries to your MySQL Database:
```sql
CREATE SCHEMA `auth`;
```
```sql
CREATE TABLE `auth`.`accounts` (
  `ID` INT NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`));
```
You can use this next command as many times as you want for the amount of users you would like to have
```sql
INSERT INTO `auth`.`accounts` (`username`, `password`)
    VALUES (
        '[USERNAME YOU WANT TO USE]',
        '[PASSWORD YOU WANT TO USE]');
```
**Make sure the MySQL User has at least `SELECT` privileges for the `auth` Database**

## Using The Web Interface

### Logging in

To Log into the Web Interface you can use the Username and Password you just defined above

![Web Interface Login Page](images/login.png)

### Navigating the Database

Once Logged in You will be able to access All of the databases where you have `SELECT` Privileges on

![Database Selection](images/database-selection.png)

After selecting a database, you will be able to choose a table in that database

![Table Select](images/table-selection.png)

After Selecting a table you will be able to see all of the data inside the table

![Table Data](images/table-data.png)

You can also click on the header to sort by that column

### Searching

Above the table to the Right there is a search bar, you can select which column to search and the query you would like to search

![Search Bar Column Selection](images/searchbar-columns.png)
![Search Bar Search Query](images/searchbar-query.png)
![Search Bar Search Results](images/searchbar-results.png)

### Creating/Editing/Deleting an Entry

The First Column of the table is a Dedicated Action Column, here you can find the Create, Edit, and Delete buttons

![Record Actions](images/dedicated-action-column.png)

Create and Edit open a similar page, the only difference is the create page is not prefilled with record data

Here you can manually add or change information in a record

![Edit Page](images/edit-page.png)

The Delete Button will first show you a confirmation through your browser

![Delete Confirmation](images/delete-confirmation.png)

Hitting Cancel wont do anything, hitting Okay will send you to another page where you will need to type in the ID of the record you want to delete

![Delete Page](images/delete-page.png)

After hitting delete the record will no longer be shown and you will be returned to the table screen

