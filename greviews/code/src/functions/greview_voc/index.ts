import {publicSDK } from '@devrev/typescript-sdk';
import { ApiUtils, HTTPResponse } from './utils';
// import {LLMUtils} from './llm_utils';
export const run = async (events: any[]) => {
  for (const event of events) {
  }
    const endpoint: string = events[0].execution_metadata.devrev_endpoint;
    const token: string = events[0].context.secrets.service_account_token;
    const fireWorksApiKey: string = events[0].input_data.keyrings.fireworks_api_key;
    const apiUtil: ApiUtils = new ApiUtils(endpoint, token);
    const snapInId = events[0].context.snap_in_id;
    const inputs = events[0].input_data.global_values;
    const tags = events[0].input_data.resources.tags;
    let parameters:string = events[0].payload.parameters.trim();
    let numreviews= 10
    numreviews = parseInt(parameters);

    const url = 'https://google-reviews-scraper.p.rapidapi.com/?id=U2FsdGVkX1%252F8GUUq17u0Yi%252BrtxMkNkUMAYn%252BaV95mi%252B3DFQVlhH1%252F7wT8%252FYx%252FDklSqo1IHA32nPTq2K%252BVJX%252FOw%253D%253D&sort=relevant&nextpage=false';
    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': 'a5c69aa55emshf8282efe0cc1955p1d4395jsn9c79db8d63ea',
        'X-RapidAPI-Host': 'google-reviews-scraper.p.rapidapi.com'
      }
    };
    

      const response = await fetch(url, options).then(response => response.json()).then(response => response.reviews);;

    for(const review of response) {

      const reviewTitle = `Ticket created from google review by ${review.author}`;
      let llmResponse= await fetch('https://api.fireworks.ai/inference/v1/completions', {
        method: 'POST',
        headers: {
          'Accept': "application/json",
          'Content-Type': "application/json",
          'Authorization': `Bearer ${fireWorksApiKey}`
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
          
          prompt: `you are an expert at cleaning, lablelling, categorising and analysing the given Trustpilot reviews for the company ${inputs['company']}. You will recieve a review. The output should be json with fields: "Relevance", "Sentiments", "Category", "sub_category", "Severity", "Feature" , "insight", "description", "response" and "review". Under "Relevance" write false if the text is not related to the company or it is a general statement otherwise mention true. Under "Sentiment" mention the sentiment of the tweet between "Positive" or "Negative". For "Category" choose only between a "bug", "complaint", "general_feedback", "suggestion", "praise", "security_concern", "pricing" or "question". Under "sub_category" if "Category" is "bug" then choose between "blocking", "major", "minor" or "trivial", if "Category is "complaint" choose between "functional", "usability", "performance" or "customer service", if "Category" is "general feedback" then "sub_category" will be "-" , if "Category" is "security_concern" then "sub_category" will be "vulnerability" or "privacy issue", if "Category" is "question" then "sub_category" will be "-" , if "Category" is "pricing" then "sub_category" will be "expensive", "cheap" or "value for money", if "Category" is "praise" then "sub_category" will be what benefit was received. Under "Feature" mention the feature that the review is about.Under "Severity" choose between "Blocker", "High", "Low" or "Medium". Under "insight" mention the action elaborately that the company should take based on the review. Under "description" mention the elaborate description of the problem. Under "response" add an elaborate professional response to the customer from the company. Under "review" add the review after removing all links starting with "https://t.co/". The review: ${review.comment}`,
        })
      }).then(response => response.json())
      .then(response => JSON.parse(response.choices[0].text));
    
      interface Review {
        Relevance: boolean;
        Sentiments: string;
        Category: string;
        sub_category: string;
        Severity: publicSDK.TicketSeverity;
        Feature: string;
        insight: string;
        description: string;
        response: string;
        review: string;
      }
    let ans:Review = llmResponse

      let inferredCategory = ans.Category;
     
      if (!(inferredCategory in tags)) {
          inferredCategory = 'failed_to_infer_category';
      } 
      
      let body= `The review: ${review.comment} \n
    The description: ${ans.description} \n
      `


    if(ans.Relevance=true){
const createTicketResp = await apiUtil.createTicket({
  title: reviewTitle,
  tags: [{id: tags[inferredCategory].id},{id: tags[ans.Sentiments].id}],
  body: body,
  type: publicSDK.WorkType.Ticket,
  owned_by: [inputs['default_owner_id']],
  applies_to_part: inputs['default_part_id'],
  // is_spam: iss,
  // source_channel:'Twitter',
  severity: ans.Severity
});
if (!createTicketResp.success) {
  console.error(`Error while creating ticket: ${createTicketResp.message}`);
  continue;
}
// Post a message with ticket ID.
const ticketID = createTicketResp.data.work.id;
const ticketCreatedMessage = inferredCategory != 'failed_to_infer_category' ? `Created ticket: <${ticketID}> and it is categorized as ${inferredCategory}` : `Created ticket: <${ticketID}> and it failed to be categorized`;
const postTicketResp: HTTPResponse  = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, ticketCreatedMessage, 1);
if (!postTicketResp.success) {
  console.error(`Error while creating timeline entry: ${postTicketResp.message}`);
  continue;
}
let subcat  = await apiUtil.postTextMessage(ticketID, `<b>Sub-Category</b>: ${ans.sub_category} `);
    let sentiment  = await apiUtil.postTextMessage(ticketID, `Overall sentiment: ${ans.Sentiments} `);
    let feature  = await apiUtil.postTextMessage(ticketID, `Feature discussed: ${ans.Feature} `);
    let insight  = await apiUtil.postTextMessage(ticketID, `Actionable insight: \n
  ${ans.insight} \n`);
    let sample  = await apiUtil.postTextMessage(ticketID, `Sample Response: ${ans.response} `);
    }
  
  }
  
}


export default run;
