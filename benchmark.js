var fs = require("fs")
var path = require("path")
var eunr = require("elasticlunr");
var lunr = require("lunr")
var si = require("search-index")
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var zlib = require('zlib');

var filenames = fs.readdirSync(path.join(__dirname, "markdown"));
var batchSize = 1000;

function toFileDetails(filename) {
  var filePath = path.join(__dirname, "markdown", filename);
  fileDetails = {
    filename: filename,
    id: filePath,
    body: fs.readFileSync(filePath, 'utf8'),
    modifiedAt: fs.statSync(filePath).mtime.getTime()
  }
  return fileDetails;
}

function initSearchIndex() {
  return new Promise((resolve, reject) => {
    si({}, function(error, searchIndex) {
      if (error) {
        reject(error);
        return;
      }
      resolve(searchIndex);
    });
  });
}

function close(searchIndex) {
  return new Promise((resolve, reject) => {
    searchIndex.close(function(error) {
      error ? reject(error) : resolve();
    });
  });
}

function createBatches(batchSize) {
  var ret = [];
  while (filenames.length > 0) {
    ret.push(filenames.splice(0, batchSize));
  }
  return ret;
}

function add(searchIndex, batch) {
  var batchOptions = {
    fieldOptions: [
      {fieldName: "filename", weight: 10},
      {fieldName: "body", weight: 1}
    ]
  };
  return new Promise((resolve, reject) => {
    searchIndex.add(batch.map(toFileDetails), batchOptions, function(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function save(searchIndex) {
  return new Promise((resolve, reject) => {
    searchIndex.snapShot(function(readStream) {
      readStream.pipe(fs.createWriteStream("backup.gz"))
        .on('close', function() {
          resolve();
        });
    });
  });
}

function load(searchIndex) {
  return new Promise((resolve, reject) => {
    searchIndex.replicate(fs.createReadStream('backup.gz'), function(msg) {
      resolve();
    });
  });
}

function saveLunr(lunrIndex) {
  fs.writeFileSync(
    path.join(__dirname, 'lunr.cache'),
    zlib.deflateSync(JSON.stringify(lunrIndex)));
}

function loadLunr() {
  return lunr.Index.load(JSON.parse(zlib.inflateSync(fs.readFileSync(path.join(__dirname, 'lunr.cache')))));
}

function saveEunr(eunrIndex) {
  fs.writeFileSync(
    path.join(__dirname, 'eunr.cache'),
    zlib.deflateSync(JSON.stringify(eunrIndex)));
}

function loadEunr() {
  return eunr.Index.load(JSON.parse(zlib.inflateSync(fs.readFileSync(path.join(__dirname, 'eunr.cache')))));
}

async(function () {
  // var searchIndex = await(initSearchIndex());
  // var batches = createBatches(batchSize);
  // batches.forEach(function(batch, index) {
  //   await(add(searchIndex, batch));
  //   console.log(index * batchSize + batch.length);
  // });
  // console.log("added");
  // 
  // await(save(searchIndex));
  // await(close(searchIndex));
  // console.log("saved");
  // 
  // searchIndex = await(initSearchIndex());
  // await(load(searchIndex));
  // await(close(searchIndex));
  // console.log("loaded");
  
  var lunrIndex = lunr(function() {
    this.field("filename", { boost: 10 })
    this.field("body")
  });
  
  filenames.forEach(function(filename, index) {
    lunrIndex.add(toFileDetails(filename));
    if (index % batchSize == 0 && index != 0) {
      console.log(index);
    }
  });
  console.log("added");
  saveLunr(lunrIndex);
  console.log("saved");
  lunrIndex = loadLunr();
  console.log("loaded");
  
  var eunrIndex = eunr(function() {
    this.addField("filename");
    this.addField("body");
    this.setRef("id");
  });
  filenames.forEach(function(filename, index) {
    eunrIndex.addDoc(toFileDetails(filename));
    if (index % batchSize == 0 && index != 0) {
      console.log(index);
    }
  });
  console.log("added");
  saveEunr(eunrIndex);
  console.log("saved");
  eunrIndex = loadEunr();
  console.log("loaded");  
})();

/*
si({}, function(err, searchIndex) {
  var init = Date.now();
  var size = 0;
  var batch = [];
  var batchOptions = {
    fieldOptions: [
      {fieldName: "filename", weight: 10},
      {fieldName: "body", weight: 1}
    ]
  }
  var indexBatch = function() {
    var batchLength = batch.length;
    searchIndex.add(batch, batchOptions, function(err) {
      size += batchLength;
      console.log("" + size + "," + (Date.now() - init));
      if (size == 10001) {
        searchIndex.snapShot(function(readStream) {
          readStream.pipe(fs.createWriteStream("backup.gz"))
            .on('close', function() {
              console.log("Saved");
            });
        });
      }
    });
    batch = [];    
  }
  filenames.forEach(function(filename) {
    var filePath = path.join(__dirname, "markdown", filename);

    fileDetails = {
      filename: filename,
      id: filePath,
      body: fs.readFileSync(filePath),
      modifiedAt: fs.statSync(filePath).mtime.getTime()
    }

    batch.push(fileDetails)
    if (batch.length == 1000) {
      indexBatch()
    }
  })
  indexBatch()
  console.log("Fixtures loaded")
});

// var lunrIndex = lunr(function() {
//   this.field("filename", { boost: 10 })
//   this.field("body")
// })

// lunrIndex.add(allFileDetails[path])
*/