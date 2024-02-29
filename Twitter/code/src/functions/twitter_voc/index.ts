import {publicSDK } from '@devrev/typescript-sdk';
import { ApiUtils, HTTPResponse } from './utils';
import { number } from 'yargs';
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
    let response = await fetch('https://twitter154.p.rapidapi.com/search/search', {
    method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': 'cd96441afemsh0ebe45c0b03839ap1a0d06jsnf4bf602e232f',
        'X-RapidAPI-Host': 'twitter154.p.rapidapi.com'
      },
      body: JSON.stringify({
        query: inputs['company_id'],
        limit: numreviews,
        section: 'top',
        language: 'en'
      })
    
      }).then(response => response.json()).then(response => response.results);;
      


      for(const review of response) {
        const reviewTitle = `Ticket created from twitter: ${review.expanded_url || review.tweet_id}`;
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
            
            prompt: `you are an expert at cleaning, lablelling, categorising and analysing the given Trustpilot reviews for the company ${inputs['company_id']}. You will recieve a review. The output should be json with fields: "Relevance", "Sentiments", "Category", "sub_category", "Severity", "Feature" , "insight", "description", "response" and "review". Under "Relevance" write false if the text is not related to the company or it is a general statement otherwise mention true. Under "Sentiment" mention the sentiment of the tweet between "Positive" or "Negative". For "Category" choose only between a "bug", "complaint", "general_feedback", "suggestion", "praise", "security_concern", "pricing" or "question". Under "sub_category" if "Category" is "bug" then choose between "blocking", "major", "minor" or "trivial", if "Category is "complaint" choose between "functional", "usability", "performance" or "customer service", if "Category" is "general feedback" then "sub_category" will be "-" , if "Category" is "security_concern" then "sub_category" will be "vulnerability" or "privacy issue", if "Category" is "question" then "sub_category" will be "-" , if "Category" is "pricing" then "sub_category" will be "expensive", "cheap" or "value for money", if "Category" is "praise" then "sub_category" will be what benefit was received. Under "Feature" mention the feature that the review is about.Under "Severity" choose between "Blocker", "High", "Low" or "Medium". Under "insight" mention the action elaborately that the company should take based on the review. Under "description" mention the elaborate description of the problem. Under "response" add an elaborate professional response to the customer from the company. Under "review" add the review after removing all links starting with "https://t.co/". The review: ${review.text}`,
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
        
        let body= `The review: ${review.text} \n
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
