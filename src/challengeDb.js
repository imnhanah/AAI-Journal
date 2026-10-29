import { supabase } from './supabaseClient';
import * as local from './localJournalDb';
import { createChallengeStorage } from './challengeStorage.js';

export const challengeDb = createChallengeStorage({ isLocal: local.isLocalJournal, local, cloud: supabase });
