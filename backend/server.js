import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

import {
  createSurvey,
  updateSurveyStatus,
  getSurvey,
  createResponse,
  updateResponse,
  getSurveyResponses
} from './supabaseClient.js';

import {
  initiateCall,
  generateGreetingTwiml,
  generateQuestion1ResponseTwiml,
  generateQuestion2ResponseTwiml,
  generateQuestion3ResponseTwiml,
  getCallState,
  updateCallState,
  cleanupCallState
} from './twilioIVR.js';

import {
  parseExcelFile,
  generateUpdatedExcel,
  formatPhoneNumber,
  isValidPhoneNumber
} from './excelUtils.js';

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, 'uploads');
const resultsDir = path.join(__dirname, 'results');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });

app.get('/', (_, res) => {
  res.json({ success: true, message: 'Backend Running' });
});

app.post('/api/surveys/upload', upload.single('file'), async (req, res) => {
  try {
    const parsed = parseExcelFile(req.file.path);

    const contacts = parsed.contacts.filter(c =>
      isValidPhoneNumber(c.phone)
    );

    const survey = await createSurvey(req.file.originalname, parsed);

    for (const contact of contacts) {
      await createResponse(survey.id, contact);
    }

    res.json({
      success: true,
      survey: {
        id: survey.id,
        fileName: survey.file_name,
        totalContacts: contacts.length,
        status: 'pending'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/surveys/:surveyId/start-calls', async (req, res) => {
  try {
    const surveyId = req.params.surveyId;
    const responses = await getSurveyResponses(surveyId);

    await updateSurveyStatus(surveyId, { status: 'in_progress' });

    for (const row of responses) {
      try {
        await initiateCall(
          surveyId,
          row.id,
          row.contact_name,
          formatPhoneNumber(row.phone_number)
        );
      } catch {
        await updateResponse(row.id, { status: 'failed' });
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/surveys/:surveyId/progress', async (req, res) => {
  try {
    const surveyId = req.params.surveyId;

    const survey = await getSurvey(surveyId);
    const responses = await getSurveyResponses(surveyId);

    const total = responses.length;

    const completed = responses.filter(
      r => r.status === 'completed'
    ).length;

    const failed = responses.filter(r =>
      ['failed', 'busy', 'no-answer', 'canceled'].includes(r.status)
    ).length;

    const pending = total - completed - failed;

    let status = survey.status;

    if (pending === 0 && total > 0) {
      status = 'completed';
      await updateSurveyStatus(surveyId, { status: 'completed' });
    }

    res.json({
      success: true,
      surveyId,
      status,
      totalContacts: total,
      completed,
      failed,
      pending,
      progress: {
        percentage: total === 0 ? 0 : Math.round(((completed + failed) / total) * 100),
        completed: completed + failed,
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ivr/status', async (req, res) => {
  try {
    const { CallSid, CallStatus } = req.body;

    const state = getCallState(CallSid);

    if (!state) return res.sendStatus(200);

    if (CallStatus === 'completed') {
      await updateResponse(state.responseId, {
        status: 'completed',
        answers: state.answers
      });
    }

    if (
      ['failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)
    ) {
      await updateResponse(state.responseId, {
        status: CallStatus
      });
    }

    if (
      ['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)
    ) {
      cleanupCallState(CallSid);
    }

    res.sendStatus(200);
  } catch {
    res.sendStatus(200);
  }
});

app.post('/api/ivr/greeting', (req, res) => {
  res.type('text/xml');
  res.send(generateGreetingTwiml(req.query.name || 'Friend'));
});

app.post('/api/ivr/question1', (req, res) => {
  const { Digits, CallSid } = req.body;

  const state = getCallState(CallSid);
  if (state) {
    state.answers.math12thPassed = Digits === '1';
    updateCallState(CallSid, state);
  }

  res.type('text/xml');
  res.send(generateQuestion1ResponseTwiml(Digits));
});

app.post('/api/ivr/question2', (req, res) => {
  const { Digits, CallSid } = req.body;

  const state = getCallState(CallSid);
  if (state) {
    state.answers.engineeringInterested = Digits === '1';
    updateCallState(CallSid, state);
  }

  res.type('text/xml');
  res.send(generateQuestion2ResponseTwiml(Digits));
});

app.post('/api/ivr/question3', (req, res) => {
  const { Digits, CallSid } = req.body;

  cleanupCallState(CallSid);

  res.type('text/xml');
  res.send(generateQuestion3ResponseTwiml(Digits));
});

app.get('/api/surveys/:surveyId/download', async (req, res) => {
  try {
    const survey = await getSurvey(req.params.surveyId);
    const responses = await getSurveyResponses(req.params.surveyId);

    const output = path.join(resultsDir, `results-${Date.now()}.xlsx`);

    generateUpdatedExcel(
      survey.excel_data.originalData || [],
      responses,
      output
    );

    res.download(output);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});