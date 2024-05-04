function parseQuery(query) {
  let queries = {}
  for (i of query.slice(1).split("&")) {
    let j = i.split("=")
    if (j[1] == undefined || j[1] == '') continue;
    queries[j[0]] = j[1]
  }
  queries.toString = () => {
    let string = '?'
    for (i in queries) {
      if (i == 'toString') continue;
      string += `${i}=${queries[i]}&`
    }
    return string.slice(0, -1)
  }
  return queries
}


function db_submit() {
  let query = parseQuery(location.search)
  query.db = document.getElementById("db-sel").value
  delete query.table
  location.search = query.toString()
}

function table_submit() {
  let query = parseQuery(location.search)
  query.table = document.getElementById("table-sel").value
  location.search = query.toString()
}

function record_edit(id) {
  let query = parseQuery(location.search)
  query.edit = id
  location.search = query.toString()
}

function record_delete(id) {
  if (confirm(`Are you sure you would like to delete Record ID "${id}"?`)) {
    let query = parseQuery(location.search)
    query.delete = id
    location.search = query.toString()
  }
}

function record_create() {
  let query = parseQuery(location.search)
  query.create = 'true'
  location.search = query.toString()
}

function sort_by_column(column) {
  let query = parseQuery(location.search)
  if (query.sortBy == column && query.reversed == 'false') {
    query.sortBy = column
    query.reversed = 'true'
  } else {
    query.sortBy = column
    query.reversed = 'false'
  }
  location.search = query.toString()
}

function search_table() {
  let query = parseQuery(location.search)
  query.searchCol = document.getElementById("search-column").value
  query.searchQuery = document.getElementById("searchbar").value
  location.search = query.toString()
}