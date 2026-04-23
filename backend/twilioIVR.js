import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  throw new Error('Missing Twilio environment variables');
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://call-agent-envo.onrender.com';

const client = twilio(accountSid, authToken);

const callState = new Map();

export async function initiateCall(
  surveyId,
  responseId,
  contactName,
  phoneNumber
) {
  const call = await client.calls.create({
    to: phoneNumber,
    from: fromNumber,
    url:
      `${BACKEND_URL}/api/ivr/greeting` +
      `?name=${encodeURIComponent(contactName)}`,
    method: 'POST',

    statusCallback: `${BACKEND_URL}/api/ivr/status`,
    statusCallbackMethod: 'POST',
    statusCallbackEvent: [
      'initiated',
      'ringing',
      'answered',
      'completed'
    ]
  });

  callState.set(call.sid, {
    surveyId,
    responseId,
    contactName,
    phoneNumber,
    answers: {}
  });

  console.log('Call started:', call.sid);

  return call;
}

export function generateGreetingTwiml(name) {
  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    timeout: 7,
    action: `${BACKEND_URL}/api/ivr/question1`,
    method: 'POST'
  });

  gather.say(
    `Hello ${name}. Press 1 if you passed twelfth with maths. Press 2 if no.`
  );

  twiml.say('No input received. Goodbye.');
  twiml.hangup();

  return twiml.toString();
}

export function generateQuestion1ResponseTwiml(digit) {
  const twiml = new twilio.twiml.VoiceResponse();

  if (digit === '1') {
    const gather = twiml.gather({
      numDigits: 1,
      timeout: 7,
      action: `${BACKEND_URL}/api/ivr/question2`,
      method: 'POST'
    });

    gather.say(
      'Interested in engineering? Press 1 yes. Press 2 no.'
    );
  } else {
    twiml.say('Thank you.');
    twiml.hangup();
  }

  return twiml.toString();
}

export function generateQuestion2ResponseTwiml(digit) {
  const twiml = new twilio.twiml.VoiceResponse();

  if (digit === '1') {
    twiml.say('Great. Thank you.');
    twiml.hangup();
  } else {
    const gather = twiml.gather({
      numDigits: 1,
      timeout: 7,
      action: `${BACKEND_URL}/api/ivr/question3`,
      method: 'POST'
    });

    gather.say(
      'Press 1 science. Press 2 commerce. Press 3 arts. Press 4 other.'
    );
  }

  return twiml.toString();
}

export function generateQuestion3ResponseTwiml() {
  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say('Survey completed. Thank you.');
  twiml.hangup();

  return twiml.toString();
}

export function getCallState(id) {
  return callState.get(id);
}

export function updateCallState(id, data) {
  const old = callState.get(id) || {};
  callState.set(id, {
    ...old,
    ...data
  });
}

export function cleanupCallState(id) {
  callState.delete(id);
}