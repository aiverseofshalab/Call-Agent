import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

//
// CREATE SURVEY
//
export async function createSurvey(fileName, excelData) {
  const total =
    excelData?.contacts?.length ||
    excelData?.length ||
    0;

  const { data, error } = await supabase
    .from('surveys')
    .insert([
      {
        file_name: fileName,
        total_contacts: total,
        excel_data: excelData,
        status: 'pending'
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

//
// UPDATE SURVEY STATUS
//
export async function updateSurveyStatus(surveyId, updates) {
  const { data, error } = await supabase
    .from('surveys')
    .update(updates)
    .eq('id', surveyId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

//
// GET SURVEY
//
export async function getSurvey(surveyId) {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', surveyId)
    .single();

  if (error) throw error;
  return data;
}

//
// CREATE RESPONSE
//
export async function createResponse(surveyId, contactData) {
  const { data, error } = await supabase
    .from('responses')
    .insert([
      {
        survey_id: surveyId,
        contact_name: contactData.name,
        phone_number: contactData.phone,
        call_status: 'pending'
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

//
// FINAL FIXED UPDATE RESPONSE
//
export async function updateResponse(responseId, updates) {
  const payload = {};

  if (updates.status) {
    payload.call_status = updates.status;
  }

  if (updates.answers) {
    payload.math_12th_passed =
      updates.answers.math12thPassed ?? null;

    payload.engineering_interested =
      updates.answers.engineeringInterested ?? null;

    payload.alternative_course =
      updates.answers.alternativeCourse ?? null;
  }

  const { data, error } = await supabase
    .from('responses')
    .update(payload)
    .eq('id', responseId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

//
// GET RESPONSES
//
export async function getSurveyResponses(surveyId) {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('survey_id', surveyId)
    .order('id', { ascending: true });

  if (error) throw error;

  // IMPORTANT normalize field
  return data.map((row) => ({
    ...row,
    status: row.call_status
  }));
}