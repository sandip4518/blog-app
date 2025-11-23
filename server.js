const path = require('path');
const express = require('express');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const db = require('./database');
const createDomPurify = require('isomorphic-dompurify');
const { JSDOM } = require('jsdom');

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

// Routes
// Home - list posts
app.get('/', (req, res) => {
  const searchQuery = req.query.q || '';
  let posts;
  
  if (searchQuery) {
    const term = `%${searchQuery}%`;
    posts = db.prepare('SELECT * FROM posts WHERE title LIKE ? OR content LIKE ? ORDER BY createdAt DESC').all(term, term);
  } else {
    posts = db.prepare('SELECT * FROM posts ORDER BY createdAt DESC').all();
  }
  
  // Add preview image to posts
  posts = posts.map(p => ({
    ...p,
    previewImage: extractFirstImage(p.content)
  }));
  
  res.render('index', { posts, title: 'My Blog', searchQuery });
});

// New post form
app.get('/posts/new', (req, res) => {
  res.render('new', { title: 'New Post' });
});

// Create post
app.post('/posts', (req, res) => {
  const { title = '', content = '' } = req.body;
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  
  if (!trimmedTitle && !trimmedContent) {
    return res.redirect('/');
  }

  const stmt = db.prepare('INSERT INTO posts (title, content, createdAt) VALUES (?, ?, ?)');
  stmt.run(trimmedTitle || 'Untitled', trimmedContent, new Date().toISOString());
  
  res.redirect('/');
});

// Show single post
app.get('/posts/:id', (req, res) => {
  const id = Number(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  
  if (!post) return res.status(404).render('404', { title: 'Not Found' });
  res.render('show', { post, title: post.title });
});

// Edit form
app.get('/posts/:id/edit', (req, res) => {
  const id = Number(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  
  if (!post) return res.status(404).render('404', { title: 'Not Found' });
  res.render('edit', { post, title: `Edit: ${post.title}` });
});

// Update post
app.put('/posts/:id', (req, res) => {
  const id = Number(req.params.id);
  const { title = '', content = '' } = req.body;
  
  const stmt = db.prepare('UPDATE posts SET title = ?, content = ? WHERE id = ?');
  const result = stmt.run(title.trim() || 'Untitled', content.trim(), id);
  
  if (result.changes === 0) return res.status(404).render('404');
  
  res.redirect(`/posts/${id}`);
});

// Delete post
app.delete('/posts/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  res.redirect('/');
});

// 404 fallback
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`Blog app listening on http://localhost:${PORT}`);
});
