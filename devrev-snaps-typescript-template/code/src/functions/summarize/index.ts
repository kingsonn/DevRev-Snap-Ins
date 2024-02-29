import { client, publicSDK } from "@devrev/typescript-sdk";

export async function handleEvent(
  event: any,
) {
  const devrevPAT = event.context.secrets.service_account_token;
  const APIBase = event.execution_metadata.devrev_endpoint;
  const tags = event.input_data.resources.tags;
  const snapInId = event.context.snap_in_id;

  const devrevSDK = client.setup({
    endpoint: APIBase,
    token: devrevPAT,
  })
  const tick = await devrevSDK.worksExport({
    type: publicSDK.WorkType.Ticket,
    // tags: [tags['complaint'].id],

  } as any).then(response => response.data.works)
  const psents = await devrevSDK.worksExport({
    type: publicSDK.WorkType.Ticket,
    tags: [tags['Positive'].id],

  } as any).then(response => response.data.works.length)
  const nsents = await devrevSDK.worksExport({
    type: publicSDK.WorkType.Ticket,
    tags: [tags['Negative'].id],
  } as any).then(response => response.data.works.length)
  const ppsent = (psents/(psents+nsents))*100
  const npsent = (nsents/(psents+nsents))*100
 
let allres=[]
  for(const res of tick){
allres.push(res.body)
  }
  let llmResponse= await fetch('https://api.fireworks.ai/inference/v1/completions', {
    method: 'POST',
    headers: {
      'Accept': "application/json",
      'Content-Type': "application/json",
      'Authorization': `Bearer vN6345eQwVxA2utEZBSFcibzt4k9gsYjn0DICMz8g7lrmKz9`
    },
    body: JSON.stringify({
      model: "accounts/fireworks/models/mixtral-8x7b-instruct",
      max_tokens: 4096,
      top_p: 1,
      top_k: 40,
      presence_penalty: 0,
      frequency_penalty: 0,
      temperature: 0.6,
      // type : "json_object" ,
      response_format: {type: 'json_object'},
      
      prompt: `you are an expert at analysing voice of customer data. You are given an array of reviews. The output will be in json format with fields: "customer_likings": here explain what the customers are liking breifly, "customer_pain_points": here explain the pain points customer are facing briefly, "focus": here give the topic names the company should focus on and "actions": here give all the neseccary actions the company should take in breif pointers and this is their positive sentiment%: ${ppsent} give recommendation on how they can improve. The reviews: ${allres} `,
    })
  }).then(response => response.json())
  .then(response => JSON.parse(response.choices[0].text));

  interface Analysis {
    customer_likings: string;
    customer_pain_points: string;
    focus: string;
    actions: string;
  }
let ans:Analysis = llmResponse
await devrevSDK.timelineEntriesCreate({
body:`Positive sentiment %: ${ppsent} `,
body_type: publicSDK.TimelineCommentBodyType.Text,
object: snapInId,
type: publicSDK.TimelineEntriesCreateRequestType.TimelineComment,
visibility: publicSDK.TimelineEntryVisibility.Internal,

}as publicSDK.TimelineEntriesCreateRequest)
await devrevSDK.timelineEntriesCreate({
body:`Negative sentiment %: ${npsent} `,
body_type: publicSDK.TimelineCommentBodyType.Text,
object: snapInId,
type: publicSDK.TimelineEntriesCreateRequestType.TimelineComment,
visibility: publicSDK.TimelineEntryVisibility.Internal,

}as publicSDK.TimelineEntriesCreateRequest)
// await devrevSDK.timelineEntriesCreate({
// body:`Bugs: ${bgs} Complaints: ${compl} Questions: ${ques} General-Feedback: ${genf} Suggestion: ${sug} Praise: ${prais} `,
// body_type: publicSDK.TimelineCommentBodyType.Text,
// object: snapInId,
// type: publicSDK.TimelineEntriesCreateRequestType.TimelineComment,
// visibility: publicSDK.TimelineEntryVisibility.Internal,

// }as publicSDK.TimelineEntriesCreateRequest)
await devrevSDK.timelineEntriesCreate({
body:`Customer likings: ${ans.customer_likings}`,
body_type: publicSDK.TimelineCommentBodyType.Text,
object: snapInId,
type: publicSDK.TimelineEntriesCreateRequestType.TimelineComment,
visibility: publicSDK.TimelineEntryVisibility.Internal,

}as publicSDK.TimelineEntriesCreateRequest)
await devrevSDK.timelineEntriesCreate({
body:`Customer Pain-Points: ${ans.customer_pain_points}`,
body_type: publicSDK.TimelineCommentBodyType.Text,
object: snapInId,
type: publicSDK.TimelineEntriesCreateRequestType.TimelineComment,
visibility: publicSDK.TimelineEntryVisibility.Internal,

}as publicSDK.TimelineEntriesCreateRequest)
await devrevSDK.timelineEntriesCreate({
body:`Areas to focus on:   \n
${ans.focus} \n`,
body_type: publicSDK.TimelineCommentBodyType.Text,
object: snapInId,
type: publicSDK.TimelineEntriesCreateRequestType.TimelineComment,
visibility: publicSDK.TimelineEntryVisibility.Internal,

}as publicSDK.TimelineEntriesCreateRequest)
await devrevSDK.timelineEntriesCreate({
body:`Actions to take: ${ans.actions}`,
body_type: publicSDK.TimelineCommentBodyType.Text,
object: snapInId,
type: publicSDK.TimelineEntriesCreateRequestType.TimelineComment,
visibility: publicSDK.TimelineEntryVisibility.Internal,

}as publicSDK.TimelineEntriesCreateRequest)

  // try {
  //   const response = await devrevSDK.worksList({
  //     limit: 1,
  //     type: [publicSDK.WorkType.Ticket]
  //   });
  //   return response;
  // } catch (error) {
  //   console.log(error);
  //   return error;
  // }
}

export const run = async (events: any[]) => {
  /*
  Put your code here to handle the event.
  */
  for (let event of events) {
    await handleEvent(event);
  }
};

export default run;
