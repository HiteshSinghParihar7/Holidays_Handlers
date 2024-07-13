const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const mong_url = "mongodb://127.0.0.1:27017/Holiday_handlers";
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const WrapAsync = require("./utils/WrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const { isLoggedin,isOwner,isReviewAuthor } = require("./middleware.js");
const { saveRedirectUrl } = require("./middleware.js");
const multer  = require('multer')
const upload = multer({ dest: 'uploads/' })


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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }))
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);

const store = MongoStore.create({
    mongoUrl: mong_url,
    crypto: {
        secret: process.env.SECRET,
    },
    touchAfter: 24 * 3600,
});

store.on("error", () => {
    console.log("Error in Mongo session store", err);
})

const sessionOptions = {
    store,
    secret: "HSPCR7",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7*24*60*60*1000 ,
        maxAge: 7*24*60*60*1000 ,
        httpOnly:true
    },
};


// app.get("/", (req,res) => {
//     res.send("App working");
// })
//  app.get("/", (req, res, next) => {
//     next(new ExpressError(404, "Page Not Found! "));
// })




app.use(session(sessionOptions));
app.use(flash());


app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});



// app.get("/ls_test", async (req, res) => {
//     let samplis = new Listing({
//         title: "my new villa",
//         description: "near beach",
//         price: "120000",
//         country: "India",
//     });
//     await samplis.save();
//     console.log("sample saved");
//     res.send("succesful test");
// });

app.use(express.static(path.join(__dirname, "/public")));


const validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
        let errmsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errmsg);
    }
    next();
};

const validateReview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        let errmsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errmsg);
    }
    next();
};

//index route
app.get("/listings", WrapAsync(async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
}));

// get route
app.get("/listings/new", isLoggedin,(req, res) => {
    // console.log(req.user);
    res.render("listings/new.ejs");
});

//show route
app.get("/listings/:id", WrapAsync(async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
            path: "author",
        },
    }).populate("owner");
    if (!listing) {
        req.flash("error", "Listing you requested doesn't exit!");
        return res.redirect("/listings"); 
    }
    console.log(listing);
    res.render("listings/show.ejs", { listing });
}));

//create route
app.post("/listings", validateListing,WrapAsync(async (req, res, next) => {
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    await newListing.save();
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
    })
);

//Edit route
app.get("/listings/:id/edit", isLoggedin,isOwner,WrapAsync(async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you requested doesn't exit!");
        return res.redirect("/listings"); 
    }
    res.render("listings/edit.ejs", { listing });
}));

// update
app.put("/listings/:id", isLoggedin,isOwner,validateListing, WrapAsync(async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndUpdate(id, { ...req.body.listing }); // reconstructing the listing object.
    req.flash("success", "Listing Updated!");
    res.redirect("/listings");
}));

//delete route
app.delete("/listings/:id", isLoggedin,isOwner,WrapAsync(async (req, res) => {
    let { id } = req.params;
    let del_ls = await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing Deleted!");
    console.log(del_ls);
    res.redirect("/listings");
}));

// app.all("*", (req, res, next) => {
//     next(new ExpressError(404, "Page Not Found! "));
// })
//error handler

app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong!" } = err;
    res.status(statusCode).render("error.ejs", { message });
})

//  Reviews
//post route
app.post("/listings/:id/reviews", isLoggedin,validateReview,WrapAsync(async (req, res) => {
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);

    newReview.author = req.user._id;

    listing.reviews.push(newReview);
    await newReview.save();
    await listing.save();
    req.flash("success", "Review Saved!");
    console.log("New Review Saved!");
    res.redirect(`/listings/${listing._id}`);
}));

//delete review route
//delete route
app.delete("/listings/:id/reviews/:reviewId", isLoggedin,isReviewAuthor,WrapAsync(async (req, res) => {
    let { id,reviewId } = req.params;
    
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    req.flash("success", "Review Deleted!");
    res.redirect(`/listings/${id}`);
}));

//signup router
app.get("/signup", (req, res) => {
    res.render("users/signup.ejs");
});

app.post("/signup", WrapAsync(async (req, res) => {
    try {
        let { username, email, password } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        req.login(registeredUser, (err) => {
            if (err) {
                next(err);
            }
            req.flash("success", "Welcome to Holidays-Handlers!");
    return res.redirect("/listings");
        })
    }
    catch (e) {
        req.flash("error", e.message);
    return res.redirect("/signup");
    }
    
}));

app.get("/login", (req, res) => {
    res.render("users/login.ejs");
});

app.post("/login", saveRedirectUrl,passport.authenticate("local", {
    failureRedirect: "/login", failureFlash:true,
}), (req, res) => {
    req.flash("success", "Welcome back to Holidays-Handlers!");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
});

//logout
app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success","you are logged out!")
        res.redirect("/listings");
    })
});

app.listen(8080, () => {
    console.log("Server working");
});