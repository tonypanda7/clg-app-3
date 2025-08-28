// Quick fix for 401 error - Create missing user
const userData = {
  fullName: "Test User",
  universityEmail: "a@snuchennai.edu.in",
  password: ".x-K,.2RWPj*>i@",
  confirmPassword: ".x-K,.2RWPj*>i@"
};

console.log('Creating user for 401 fix...');
console.log('Email:', userData.universityEmail);

fetch('http://localhost:8080/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(userData)
})
.then(res => res.json())
.then(data => {
  console.log('User creation result:', data);
  if (data.success) {
    console.log('✅ User created successfully! 401 error should be fixed.');
  } else {
    console.log('❌ User creation failed:', data.message);
  }
})
.catch(err => console.error('Error:', err));
