var express = require("express"),
	app = express(),
	mongoose = require("mongoose"),
	fs = require("fs"),
	crypto = require("crypto"),
	multer = require("multer"),
	Excel = require("exceljs"),
	moment = require("moment"),
	Log = require("log"),
	bodyParser = require("body-parser");

app.set("view engine", "ejs");
app.use(express.static(__dirname + "\\public"));
app.use(bodyParser.urlencoded({extended: true}));

mongoose.connect("mongodb://192.168.11.226/salesStats");

var storage = multer.diskStorage({
	destination: function(req, file, cb){
		cb(null, ".\\uploads\\");
	},
	filename: function(req, file, cb){
		crypto.pseudoRandomBytes(16, function(err, raw){
			cb(null, raw.toString("hex") + ".xlsx");
		});
	}
});

var log = new Log("info", fs.createWriteStream(".\\logs\\app_log"+(new Date.now()).getTime()+".txt"));
var upload = multer({storage: storage});

var transactionSchema = new mongoose.Schema({
	retailerName: String,
	retailerID: Number,
	retailerMobile: Number,
	cafeName: String,
	cafeID: Number,
	cafeUniqueID: Number,
	sales: Number,
	trxDate: Date,
	registrationDate: Date,
	period: Number
});
transactionSchema.index({ cafeID: 1, trxDate: 1}, { unique: true });

var Transaction = mongoose.model("Transaction", transactionSchema);

var cafeSchema = new mongoose.Schema({
	retailerName: String,
	retailerID: String,
	retailerMobile: Number,
	cafeName: String,
	cafeID: {type: Number, unique: true, required: true, dropDups: true},
	cafeUniqueID: {type: Number, unique: true, required: true, dropDups: true},
	location: String,
	address: String,
	createdDate: Date,
});

var Cafe = mongoose.model("Cafe", cafeSchema, "cafe");

app.get("/", function(req, res){
	res.render("index");
});

app.get("/uploadcafe", function(req, res){
	res.render("uploadcafe");
});

app.get("/uploadtrx", function(req, res){
	res.render("uploadtrx");
});

app.post("/uploadcafe", upload.single("data"), function(req, res){
	console.log(req.file.filename);
	log.info("new cafe data uploaded");
	var workbook = new Excel.Workbook();
	workbook.xlsx.readFile(".\\uploads\\"+req.file.filename)
		.then(function(){
			var worksheet = workbook.getWorksheet("Sheet1");
			worksheet.eachRow(function(row, rowNumber){
				if(rowNumber !== 1){
					var inputData = {
						retailerName: row.values[1],
						retailerID: row.values[2],
						retailerMobile: row.values[3],
						cafeName: row.values[5],
						cafeID: row.values[6],
						cafeUniqueID: row.values[7],
						location: row.values[8],
						address: row.values[9],
						createdDate: row.values[10]
					};
					count = 0;
					// console.log('Row ' + rowNumber + ' = ' + JSON.stringify(row.values));
					Cafe.create(inputData, function(err, newCreate){
						if (err) return console.log(err);
						console.log(newCreate); console.log(count++);
					});
				}
			});
		});
	res.render("uploadcafe");
});

app.post("/uploadtrx", upload.single("data"), function(req, res){
	console.log(req.file.filename);
	log.info("new transaction data uploaded: "+req.file.filename);
	var workbook = new Excel.Workbook();
	workbook.xlsx.readFile(".\\uploads\\"+req.file.filename)
		.then(function(){
			var worksheet = workbook.getWorksheet("Sheet1");
			worksheet.eachRow(function(row, rowNumber){
				if(rowNumber !== 1){
					var promise = Cafe.find({cafeID: row.values[7]}, "createdDate").exec();
					promise.then(function(created){
						var createdDate = moment(created[0].createdDate);
						var trxDate = moment(req.body.date);
						var diff = trxDate.diff(createdDate, "days");
						var inputData = {
							retailerName: row.values[3],
							retailerID: row.values[4],
							retailerMobile: row.values[5],
							cafeName: row.values[6],
							cafeID: row.values[7],
							cafeUniqueID: row.values[8],
							sales: row.values[15],
							trxDate: trxDate,
							registrationDate: createdDate,
							period: diff
						};
						count = 0;
						// console.log('Row ' + rowNumber + ' = ' + JSON.stringify(row.values));
						Transaction.create(inputData, function(err, newCreate){
							if (err) return console.log(err);
							console.log(newCreate); console.log(count++);
						});
					});
					
					
					
				}
			});
		});
	res.render("uploadtrx");
});

app.get("/trxdays", function(req, res){
	log.info("trx days requested");
	Transaction.aggregate([
	{
		$match: {period: {$lte: 7}}
	},
	{
		$group: {
			_id: "$cafeID",
			trxDays: {$sum: 1}
		}
	}
	], function(err, result){
		if(err)console.log(err);
		res.json(result);
	});
});

// app.get("/process", function(req, res){
// 	var count=0;
// 	Transaction.find({}, function(err, data){
// 		data.forEach(function(datas){
// 			var a = moment(datas.trxDate);
// 			var b = moment(datas.registrationDate);
// 			var days = a.diff(b, "days");

// 			Transaction.findByIdAndUpdate(datas._id, {$set: {period: days}}, function(result){
// 				if(err)console.log(err);
// 				console.log(count++);
// 			});
// 		});
// 	});
// });
app.listen(8001, function(){
	console.log("Started");
});
