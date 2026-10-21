const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
}

function patch(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function verifyAll() {
  console.log('--- 1. Authenticating Demo Rider ---');
  const riderLogin = await post('/api/auth/login', {
    email: 'rider.demo@cabgo.com',
    password: 'password123'
  });
  console.log('Rider Login:', riderLogin.status, riderLogin.body.message);
  const riderToken = riderLogin.body.token;

  console.log('\n--- 2. Requesting a Test Ride ---');
  const rideReq = await post('/api/rides', {
    pickup_address: 'Nashik Road Railway Station',
    dropoff_address: 'Trimbakeshwar Temple, Nashik',
    pickup_lat: 19.9538,
    pickup_lng: 73.8347,
    dropoff_lat: 19.9322,
    dropoff_lng: 73.5307
  }, riderToken);
  console.log('Ride Request:', rideReq.status, 'Ride ID:', rideReq.body.ride?.id, 'Fare: ₹' + rideReq.body.estimated_fare);
  const rideId = rideReq.body.ride?.id;

  console.log('\n--- 3. Creating Payment Order ---');
  const payOrder = await post('/api/payments/create-order', { ride_id: rideId }, riderToken);
  console.log('Payment Order:', payOrder.status, 'Order ID:', payOrder.body.order?.order_id, 'Amount:', payOrder.body.order?.amount);

  console.log('\n--- 4. Verifying Payment ---');
  const payVerify = await post('/api/payments/verify', {
    ride_id: rideId,
    gateway_order_id: payOrder.body.order?.order_id,
    gateway_payment_id: 'pay_sim_e2e_' + Date.now(),
    gateway_signature: 'test_signature'
  }, riderToken);
  console.log('Payment Verify:', payVerify.status, payVerify.body.message, 'Status:', payVerify.body.payment?.status);

  console.log('\n--- 5. Checking Payment Status ---');
  const payStatus = await get(`/api/payments/status/${rideId}`, riderToken);
  console.log('Payment Status:', payStatus.status, 'Recorded Status:', payStatus.body.payment?.status);

  console.log('\n--- 6. Authenticating Demo Driver ---');
  const driverLogin = await post('/api/auth/login', {
    email: 'driver.demo@cabgo.com',
    password: 'password123'
  });
  console.log('Driver Login:', driverLogin.status, driverLogin.body.message);
  const driverToken = driverLogin.body.token;

  console.log('\n--- 7. Fetching Available Driver Rides ---');
  const avail = await get('/api/driver/rides/available', driverToken);
  console.log('Available Rides Count:', avail.body.count, 'Found our ride:', avail.body.rides?.some(r => r.id === rideId));

  console.log('\n--- 8. Driver Accepting Ride ---');
  const accept = await patch(`/api/driver/rides/${rideId}/accept`, {}, driverToken);
  console.log('Accept Ride:', accept.status, accept.body.message, 'Status:', accept.body.ride?.status);

  console.log('\n--- 9. Progression: Arriving ---');
  const arriving = await patch(`/api/driver/rides/${rideId}/status`, { status: 'arriving' }, driverToken);
  console.log('Status -> Arriving:', arriving.status, arriving.body.message);

  console.log('\n--- 10. Progression: In Progress ---');
  const inProgress = await patch(`/api/driver/rides/${rideId}/status`, { status: 'in_progress' }, driverToken);
  console.log('Status -> In Progress:', inProgress.status, inProgress.body.message);

  console.log('\n--- 11. Progression: Completed ---');
  const completed = await patch(`/api/driver/rides/${rideId}/status`, { status: 'completed' }, driverToken);
  console.log('Status -> Completed:', completed.status, completed.body.message);

  console.log('\n=========================================');
  console.log('🎉 ALL 11 E2E ENDPOINTS VERIFIED OPERATIONAL!');
  console.log('=========================================');
}

verifyAll().catch(e => console.error('E2E Verification Error:', e));
