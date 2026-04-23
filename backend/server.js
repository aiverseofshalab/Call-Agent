import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
dotenv.config();

// Custom modules
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

// Init
const app = express();
const PORT = process.env.PORT || 5000;

// __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories
const uploadsDir = path.join(__dirname, 'uploads');
const resultsDir = path.join(__dirname, 'results');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

// ==================== MIDDLEWARE ====================

// FIXED CORS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowed = [
      'http://localhost:3000',
      'https://call-agent-nu.vercel.app'
    ];

    const isVercelPreview = origin.endsWith('.vercel.app');

    if (allowed.includes(origin) || isVercelPreview) {
      return callback(null, true);
    }

    return callback(new Error('CORS not allowed'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// ==================== HEALTH ====================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'IVR Survey Backend Running'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// ==================== UPLOAD ====================

app.post('/api/surveys/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Upload request received');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log('Uploaded file:', req.file.originalname);

    const parsed = parseExcelFile(req.file.path);

    const contacts = parsed.contacts || [];
    const headers = parsed.headers || [];
    const originalData = parsed.originalData || [];

    if (contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid contacts found'
      });
    }

    const validContacts = contacts.filter((c) =>
      isValidPhoneNumber(c.phone)
    );

    if (validContacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid phone numbers found'
      });
    }

    // Create survey
    const survey = await createSurvey(req.file.originalname, {
      contacts: validContacts,
      headers,
      originalData
    });

    // Create responses
    for (const contact of validContacts) {
      await createResponse(survey.id, contact);
    }

    return res.json({
      success: true,
      survey: {
        id: survey.id,
        fileName: survey.file_name,
        totalContacts: validContacts.length,
        status: survey.status
      }
    });

  } catch (error) {
    console.error('UPLOAD ERROR:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Upload failed'
    });
  }
});

// ==================== GET SURVEY ====================

app.get('/api/surveys/:surveyId', async (req, res) => {
  try {
    const survey = await getSurvey(req.params.surveyId);
    const responses = await getSurveyResponses(req.params.surveyId);

    return res.json({
      success: true,
      survey,
      responses
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== START CALLS ====================

app.post('/api/surveys/:surveyId/start-calls', async (req, res) => {
  try {
    const surveyId = req.params.surveyId;

    const survey = await getSurvey(surveyId);
    const responses = await getSurveyResponses(surveyId);

    await updateSurveyStatus(surveyId, {
      status: 'in_progress'
    });

    for (const response of responses) {
      try {
        const phone = formatPhoneNumber(response.phone_number);

        await initiateCall(
          surveyId,
          response.id,
          response.contact_name,
          phone
        );

      } catch (err) {
        console.error('Call failed:', err);
      }
    }

    return res.json({
      success: true,
      message: 'Calling started'
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== PROGRESS ====================

app.get('/api/surveys/:surveyId/progress', async (req, res) => {
  try {
    const surveyId = req.params.surveyId;

    const survey = await getSurvey(surveyId);
    const responses = await getSurveyResponses(surveyId);

    const total = responses.length;
    const completed = responses.filter(r => r.status === 'completed').length;
    const failed = responses.filter(r => r.status === 'failed').length;
    const pending = total - completed - failed;

    let status = survey.status;

    if (pending === 0 && total > 0) {
      status = 'completed';
      await updateSurveyStatus(surveyId, { status: 'completed' });
    }

    return res.json({
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ==================== TWILIO STATUS ====================

app.post('/api/ivr/status', async (req, res) => {
  try {
    const { CallSid, CallStatus } = req.body;

    const state = getCallState(CallSid);

    if (!state) {
      return res.sendStatus(200);
    }

    if (CallStatus === 'completed') {
      await updateResponse(state.responseId, {
        status: 'completed',
        answers: state.answers
      });
    }

    if (
      CallStatus === 'failed' ||
      CallStatus === 'busy' ||
      CallStatus === 'no-answer' ||
      CallStatus === 'canceled'
    ) {
      await updateResponse(state.responseId, {
        status: 'failed'
      });
    }

    if (
      CallStatus === 'completed' ||
      CallStatus === 'failed' ||
      CallStatus === 'busy' ||
      CallStatus === 'no-answer' ||
      CallStatus === 'canceled'
    ) {
      cleanupCallState(CallSid);
    }

    res.sendStatus(200);

  } catch (error) {
    console.error(error);
    res.sendStatus(200);
  }
});

// ==================== TWILIO IVR ====================

app.post('/api/ivr/greeting', async (req, res) => {
  try {
    const { name } = req.query;
    const twiml = generateGreetingTwiml(name || 'Friend');

    res.type('text/xml');
    res.send(twiml);

  } catch (error) {
    res.type('text/xml');
    res.send('<Response><Say>Error</Say></Response>');
  }
});

app.post('/api/ivr/question1', async (req, res) => {
  try {
    const { Digits, CallSid } = req.body;

    const state = getCallState(CallSid);

    if (state) {
      state.answers.math12thPassed = Digits === '1';
      updateCallState(CallSid, state);
    }

    const twiml = generateQuestion1ResponseTwiml(Digits);

    res.type('text/xml');
    res.send(twiml);

  } catch (error) {
    res.type('text/xml');
    res.send('<Response><Say>Error</Say></Response>');
  }
});

app.post('/api/ivr/question2', async (req, res) => {
  try {
    const { Digits, CallSid } = req.body;

    const state = getCallState(CallSid);

    if (state) {
      state.answers.engineeringInterested = Digits === '1';
      updateCallState(CallSid, state);
    }

    const twiml = generateQuestion2ResponseTwiml(Digits);

    res.type('text/xml');
    res.send(twiml);

  } catch (error) {
    res.type('text/xml');
    res.send('<Response><Say>Error</Say></Response>');
  }
});

app.post('/api/ivr/question3', async (req, res) => {
  try {
    const { Digits, CallSid } = req.body;

    const twiml = generateQuestion3ResponseTwiml(Digits);

    res.type('text/xml');
    res.send(twiml);

    cleanupCallState(CallSid);

  } catch (error) {
    res.type('text/xml');
    res.send('<Response><Say>Error</Say></Response>');
  }
});

// ==================== DOWNLOAD ====================

app.get('/api/surveys/:surveyId/download', async (req, res) => {
  try {
    const surveyId = req.params.surveyId;

    const survey = await getSurvey(surveyId);
    const responses = await getSurveyResponses(surveyId);

    const outputPath = path.join(
      resultsDir,
      `results-${Date.now()}.xlsx`
    );

    generateUpdatedExcel(
      survey.excel_data.originalData || [],
      responses,
      outputPath
    );

    return res.download(outputPath);

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('UNHANDLED:', err);

  res.status(500).json({
    success: false,
    error: err.message || 'Server error'
  });
});

// ==================== START ====================

app.listen(PORT, () => {
  console.log(`IVR Survey Backend Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
});