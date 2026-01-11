import "dotenv/config";
import connectDB from "./database.js";
import path from "path";
import express from "express";
import methodOverride from "method-override";
import expressLayouts from "express-ejs-layouts";
import User from "./models/User.js";
import Post from "./models/Post.js";
import sanitizeHtml from "sanitize-html";
import bcrypt from "bcryptjs";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database
await connectDB();

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(express.json({ limit: "100mb" }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || "secret-key",
  resave: false,
  saveUninitialized: false
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const user = await User.findOne({ username });

    if (!user) {
      return done(null, false, { message: "Incorrect username." });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return done(null, false, { message: "Incorrect password." });
    }

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Middleware to pass user to views
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Make sanitizer available in views
app.use((req, res, next) => {
  res.locals.sanitizeHtml = (html) => {
    return sanitizeHtml(html);
  };
  res.locals.stripHtml = (html) => {
    return sanitizeHtml(html, {
      allowedTags: [],
      allowedAttributes: {}
    });
  };
  next();
});

// Helper to extract first image
function extractFirstImage(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src="([^">]+)"/);
  return match ? match[1] : null;
}

// Auth Middleware
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

// Routes

// Auth Routes
app.get("/login", (req, res) => {
  res.render("login", { title: "Login", error: null });
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.render("login", { 
        title: "Login", 
        error: info.message || "Invalid username or password" 
      });
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect("/");
    });
  })(req, res, next);
});

app.get("/register", (req, res) => {
  res.render("register", { title: "Register", error: null });
});

app.post("/register",  async (req, res) => {
  const { username, password } = req.body;
  
  // Validation
  if (!username || !password) {
    return res.render("register", { 
      title: "Register", 
      error: "Username and password are required" 
    });
  }
  
  if (username.trim().length < 3) {
    return res.render("register", { 
      title: "Register", 
      error: "Username must be at least 3 characters long" 
    });
  }
  
  if (password.length < 6) {
    return res.render("register", { 
      title: "Register", 
      error: "Password must be at least 6 characters long" 
    });
  }
  
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    await User.create({
      username: username.trim(),
      password: hashedPassword
    });
    
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    if (err.code === 11000) { // Duplicate key error
      return res.render("register", { 
        title: "Register", 
        error: "Username already exists. Please choose a different username." 
      });
    }
    res.render("register", { 
      title: "Register", 
      error: "An error occurred during registration. Please try again." 
    });
  }
});

app.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect("/");
  });
});

// Home - landing page
app.get("/", (req, res) => {
  res.render("landing", { title: "My Blog" });
});

// My Posts - list user's posts
app.get("/my-posts", isAuthenticated, async (req, res) => {
  const searchQuery = req.query.q || "";
  let query = { userId: req.user._id };

  if (searchQuery) {
    query.$or = [
      { title: new RegExp(searchQuery, "i") },
      { content: new RegExp(searchQuery, "i") }
    ];
  }

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .lean();

  const finalPosts = posts.map(p => ({
    ...p,
    id: p._id.toString(),
    previewImage: extractFirstImage(p.content)
  }));

  res.render("my-posts", {
    posts: finalPosts,
    title: "My Posts",
    searchQuery
  });
});

// New post form
app.get("/posts/new", isAuthenticated, (req, res) => {
  res.render("new", { title: "New Post" });
});

// Create post
app.post("/posts", isAuthenticated, async(req, res) => {
  const { title = "", content = "" } = req.body;
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  
  if (!trimmedTitle && !trimmedContent) {
    return res.redirect("/my-posts");
  }

  await Post.create({
    title: trimmedTitle || "Untitled",
    content: trimmedContent,
    userId: req.user._id
  });
  
  res.redirect("/my-posts");
});

// Show single post
app.get("/posts/:id", isAuthenticated, async (req, res) => {
  const post = await Post.findOne({
    _id: req.params.id,
    userId: req.user._id
  });
  
  if (!post) return res.status(404).render("404", { title: "Not Found" });
  res.render("show", { post, title: post.title });
});

// Edit form
app.get("/posts/:id/edit", isAuthenticated, async (req, res) => {
  const post = await Post.findOne({
    _id: req.params.id,
    userId: req.user._id
  });
  
  if (!post) return res.status(404).render("404", { title: "Not Found" });
  res.render("edit", { post, title: `Edit: ${post.title}` });
});

// Update post
app.put("/posts/:id", isAuthenticated, async (req, res) => {
  const { title = "", content = "" } = req.body;

  const result = await Post.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { title: title.trim() || "Untitled", content: content.trim() },
    { new: true }
  );

  if (!result) {
    return res.status(404).render("404");
  }

  res.redirect(`/posts/${req.params.id}`);
});

// Delete post
app.delete("/posts/:id", isAuthenticated, async (req, res) => {
  await Post.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id
  });
  res.redirect("/my-posts");
});

// 404 fallback
app.use((req, res) => {
  res.status(404).render("404", { title: "Not Found" });
});

// For ESM, require.main === module doesn't exist.
// We can check if the file is being run primarily by comparing import.meta.url
import { pathToFileURL } from "url";
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(PORT, () => {
    console.log(`Blog app listening on http://localhost:${PORT}`);
  });
}

export default app;
