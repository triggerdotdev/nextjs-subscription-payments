import { createAppRoute } from '@trigger.dev/nextjs';
import { client } from '@/trigger';

// This registers all the jobs in the jobs folder
import '@/jobs';

//this route is used to send and receive data with Trigger.dev
export const { POST, dynamic } = createAppRoute(client);
