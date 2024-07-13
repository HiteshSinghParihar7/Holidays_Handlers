const mongoose = require("mongoose");
const initData = require("./data.js");

const Listing = require("../models/listing.js");

const mong_url = "mongodb://127.0.0.1:27017/Holiday_handlers";

main()
    .then(() => {
        console.log("connect to DB");
    })
    .catch((err) => {
        console.log(err);
    })

async function main() {
    await mongoose.connect(mong_url);
}

const initDB = async () => {
    await Listing.deleteMany({});
    initData.data = initData.data.map((obj) => ({
        ...obj, 
        owner: "668cda1e2643a5fa35eb12d4",
        image: typeof obj.image === 'string' ? obj.image : obj.image.url // Ensure image is a valid URL string
    }));
    await Listing.insertMany(initData.data);
    console.log("Data initialized");
};



initDB();