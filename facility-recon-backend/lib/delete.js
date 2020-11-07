const async = require('async')
let scoreResults = []
let documents = [1,2,3,4]
async.eachSeries(documents, (document, nxtDoc) => {
  let thisRanking = {
    potentialMatches: {},
    exactMatch: {}
  }
  thisRanking.exactMatch = {
    fname: document
  }
  scoreResults.push(thisRanking)
  nxtDoc()
}, () => {
  console.log(scoreResults);
})