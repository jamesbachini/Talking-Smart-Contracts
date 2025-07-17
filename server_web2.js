const express = require('express');
const path = require('path');
const StellarSdk = require('stellar-sdk');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const contractId = 'CCAK2Y7STDCRKVM6JZTDFTVK4WVDY4JKMYZRJZP4AWL4S4MCQSWZXFDK';
const rpc = new StellarSdk.rpc.Server('https://soroban-testnet.stellar.org');
const networkPassphrase = StellarSdk.Networks.TESTNET;
const contract = new StellarSdk.Contract(contractId);

async function sendMessage(msgObj) {
  const keypair = StellarSdk.Keypair.fromSecret(msgObj.secret);
  // awful, don't use in production
  const account = await rpc.getAccount(keypair.publicKey());
  const sanitizedStr = msgObj.transcript
    .split(' ').join('_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 32);
  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  }).addOperation(contract.call("talk", 
    StellarSdk.Address.fromString(keypair.publicKey()).toScVal(),
    StellarSdk.nativeToScVal(sanitizedStr, { type: 'symbol' })
  )).setTimeout(30).build();
  const preparedTx = await rpc.prepareTransaction(tx);
  preparedTx.sign(keypair);
  const result = await rpc.sendTransaction(preparedTx);
  console.log("TX sent:", result);
  return result.hash;
}

async function fetchMessages() {
  const latest = await rpc.getLatestLedger();
  const eventsResponse = await rpc.getEvents({
    startLedger: latest.sequence - 8000,
    filters: [
      {
        type: 'contract',
        contractIds: [contractId],
      },
    ],
  });
  const newMessages = [];
  for (const event of eventsResponse.events) {
    const hexPublicKey = event.topic[0]._value._value._value.toString('hex');
    const stellarPublicKey = StellarSdk.StrKey.encodeEd25519PublicKey(Buffer.from(hexPublicKey, 'hex'));
    const obj = {
      txHash: event.txHash?.toString?.(),
      addr: stellarPublicKey,
      msg: event.value?._value?.toString?.().split('_').join(' '),
    }
    newMessages.push(obj);
  }
  return newMessages;
}

app.post('/talk', async (req, res) => {
  console.log('🗣️ Transcript:', req.body.transcript);
  try {
    const txHash = await sendMessage(req.body);
    res.json({ status: 'ok', txHash });
  } catch (err) {
    console.error('❌ Error sending message:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.get('/chat', async (req, res) => {
  try {
    const messages = await fetchMessages();
    res.json({ messages });
  } catch (err) {
    console.error('❌ Error fetching messages:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.listen(3000, () => console.log('✅ Server running at http://localhost:3000'));
