fetch('http://localhost:3000/api/sync-status')
  .then(res => res.json())
  .then(data => console.log('Server responds success:', data.success, 'Data count:', data.data ? data.data.length : null))
  .catch(err => console.error('Fetch error:', err));
