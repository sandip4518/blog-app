document.addEventListener('DOMContentLoaded', () => {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) return;

  const quill = new Quill('#editor-container', {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        ['link', 'image'],
        ['clean']
      ]
    }
  });

  // Load initial content if any (for edit mode)
  const hiddenInput = document.querySelector('input[name="content"]');
  if (hiddenInput && hiddenInput.value) {
    quill.root.innerHTML = hiddenInput.value;
  }

  // Update hidden input on form submit
  const form = editorContainer.closest('form');
  form.addEventListener('submit', (e) => {
    hiddenInput.value = quill.root.innerHTML;
  });
});
