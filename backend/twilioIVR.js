import twilio from 'twilio';
import { updateResponse } from './supabaseClient.js';

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
    url: `${BACKEND_URL}/api/ivr/greeting?name=${encodeURIComponent(contactName)}`,
    method: 'POST',
    statusCallback: `${BACKEND_URL}/api/ivr/status`,
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
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
  gather.say(`Hello ${name}. Press 1 if you passed twelfth with maths. Press 2 if no.`);
  twiml.say('No input received. Goodbye.');
  twiml.hangup();
  return twiml.toString();
}

export async function generateQuestion1ResponseTwiml(callSid, digit) {
  const twiml = new twilio.twiml.VoiceResponse();
  const state = callState.get(callSid);

  if (!state) {
    twiml.say('Error. Goodbye.');
    twiml.hangup();
    return twiml.toString();
  }

  state.answers.math12thPassed = digit === '1';

  // If user pressed 2 (No), complete call immediately
  if (digit === '2') {
    await updateResponse(state.responseId, {
      status: 'completed',
      answers: state.answers
    });
    twiml.say('Thank you for your response.');
    twiml.hangup();
    callState.delete(callSid);
    return twiml.toString();
  }

  // User pressed 1 (Yes), ask next question
  const gather = twiml.gather({
    numDigits: 1,
    timeout: 7,
    action: `${BACKEND_URL}/api/ivr/question2`,
    method: 'POST'
  });
  gather.say('Interested in engineering? Press 1 for yes. Press 2 for no.');
  return twiml.toString();
}

export async function generateQuestion2ResponseTwiml(callSid, digit) {
  const twiml = new twilio.twiml.VoiceResponse();
  const state = callState.get(callSid);

  if (!state) {
    twiml.say('Error. Goodbye.');
    twiml.hangup();
    return twiml.toString();
  }

  if (digit === '1') {
    // Interested in Engineering
    state.answers.engineeringInterested = true;
    await updateResponse(state.responseId, {
      status: 'completed',
      answers: state.answers
    });
    twiml.say('Great. Thank you for your time.');
    twiml.hangup();
    callState.delete(callSid);
  } else {
    // Not interested - ask for alternative course
    state.answers.engineeringInterested = false;
    const gather = twiml.gather({
      numDigits: 1,
      timeout: 7,
      action: `${BACKEND_URL}/api/ivr/question3`,
      method: 'POST'
    });
    gather.say('Press 1 for Science. Press 2 for Commerce. Press 3 for Arts. Press 4 for Other.');
  }

  return twiml.toString();
}

export async function generateQuestion3ResponseTwiml(callSid, digit) {
  const twiml = new twilio.twiml.VoiceResponse();
  const state = callState.get(callSid);

  if (!state) {
    twiml.say('Error. Goodbye.');
    twiml.hangup();
    return twiml.toString();
  }

  const courseMap = {
    '1': 'Science',
    '2': 'Commerce',
    '3': 'Arts',
    '4': 'Other'
  };

  state.answers.alternativeCourse = courseMap[digit] || 'Other';

  // Mark as completed with all answers
  await updateResponse(state.responseId, {
    status: 'completed',
    answers: state.answers
  });

  twiml.say('Survey completed. Thank you for your time.');
  twiml.hangup();
  callState.delete(callSid);

  return twiml.toString();
}

export function getCallState(id) {
  return callState.get(id);
}

export function updateCallState(id, data) {
  const old = callState.get(id) || {};
  callState.set(id, { ...old, ...data });
}

export function cleanupCallState(id) {
  callState.delete(id);
}