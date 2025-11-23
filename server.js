const path = require('path');
const express = require('express');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const db = require('./database');
const createDomPurify = require('isomorphic-dompurify');
const { JSDOM } = require('jsdom');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const window = new JSDOM('').window;
const DOMPurify = createDomPurify(window);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.json({ limit: '100mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
  secret: 'secret-key', // In production, use a secure env variable
  resave: false,
  saveUninitialized: false
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy((username, password, done) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return done(null, false, { message: 'Incorrect username.' });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      return done(null, false, { message: 'Incorrect password.' });
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
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
    return DOMPurify.sanitize(html);
  };
  res.locals.stripHtml = (html) => {
    return html.replace(/<[^>]*>?/gm, '');
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
  res.redirect('/login');
}

// Routes

// Auth Routes
app.get('/login', (req, res) => {
  res.render('login', { title: 'Login', error: null });
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.render('login', { 
        title: 'Login', 
        error: info.message || 'Invalid username or password' 
      });
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect('/');
    });
  })(req, res, next);
});

app.get('/register', (req, res) => {
  res.render('register', { title: 'Register', error: null });
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  
  // Validation
  if (!username || !password) {
    return res.render('register', { 
      title: 'Register', 
      error: 'Username and password are required' 
    });
  }
  
  if (username.trim().length < 3) {
    return res.render('register', { 
      title: 'Register', 
      error: 'Username must be at least 3 characters long' 
    });
  }
  
  if (password.length < 6) {
    return res.render('register', { 
      title: 'Register', 
      error: 'Password must be at least 6 characters long' 
    });
  }
  
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    stmt.run(username.trim(), hashedPassword);
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.render('register', { 
        title: 'Register', 
        error: 'Username already exists. Please choose a different username.' 
      });
    }
    res.render('register', { 
      title: 'Register', 
      error: 'An error occurred during registration. Please try again.' 
    });
  }
});

app.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});
// Home - landing page
app.get('/', (req, res) => {
  res.render('landing', { title: 'My Blog' });
});

// My Posts - list user's posts
app.get('/my-posts', isAuthenticated, (req, res) => {
  const searchQuery = req.query.q || '';
  let posts;
  
  if (searchQuery) {
    const term = `%${searchQuery}%`;
    posts = db.prepare('SELECT * FROM posts WHERE userId = ? AND (title LIKE ? OR content LIKE ?) ORDER BY createdAt DESC').all(req.user.id, term, term);
  } else {
    posts = db.prepare('SELECT * FROM posts WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id);
  }
  
  // Add preview image to posts
  posts = posts.map(p => ({
    ...p,
    previewImage: extractFirstImage(p.content)
  }));
  
  res.render('my-posts', { posts, title: 'My Posts', searchQuery });
});

// New post form
app.get('/posts/new', isAuthenticated, (req, res) => {
  res.render('new', { title: 'New Post' });
});

// Create post
app.post('/posts', isAuthenticated, (req, res) => {
  const { title = '', content = '' } = req.body;
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  
  if (!trimmedTitle && !trimmedContent) {
    return res.redirect('/my-posts');
  }

  const stmt = db.prepare('INSERT INTO posts (title, content, createdAt, userId) VALUES (?, ?, ?, ?)');
  stmt.run(trimmedTitle || 'Untitled', trimmedContent, new Date().toISOString(), req.user.id);
  
  res.redirect('/my-posts');
});

// Show single post
app.get('/posts/:id', isAuthenticated, (req, res) => {
  const id = Number(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND userId = ?').get(id, req.user.id);
  
  if (!post) return res.status(404).render('404', { title: 'Not Found' });
  res.render('show', { post, title: post.title });
});

// Edit form
app.get('/posts/:id/edit', isAuthenticated, (req, res) => {
  const id = Number(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND userId = ?').get(id, req.user.id);
  
  if (!post) return res.status(404).render('404', { title: 'Not Found' });
  res.render('edit', { post, title: `Edit: ${post.title}` });
});

// Update post
app.put('/posts/:id', isAuthenticated, (req, res) => {
  const id = Number(req.params.id);
  const { title = '', content = '' } = req.body;
  
  const stmt = db.prepare('UPDATE posts SET title = ?, content = ? WHERE id = ? AND userId = ?');
  const result = stmt.run(title.trim() || 'Untitled', content.trim(), id, req.user.id);
  
  if (result.changes === 0) return res.status(404).render('404');
  
  res.redirect(`/posts/${id}`);
});

// Delete post
app.delete('/posts/:id', isAuthenticated, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ? AND userId = ?').run(id, req.user.id);
  res.redirect('/my-posts');
});

// 404 fallback
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`Blog app listening on http://localhost:${PORT}`);
});
