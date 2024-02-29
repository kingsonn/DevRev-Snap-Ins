import {publicSDK } from '@devrev/typescript-sdk';
import { ApiUtils, HTTPResponse } from './utils';
// import {LLMUtils} from './llm_utils';
export const run = async (events: any[]) => {
  for (const event of events) {
  }
    const endpoint: string = events[0].execution_metadata.devrev_endpoint;
    const token: string = events[0].context.secrets.service_account_token;
    // const fireWorksApiKey: string = events[0].input_data.keyrings.fireworks_api_key;
    const apiUtil: ApiUtils = new ApiUtils(endpoint, token);
    // Get the number of reviews to fetch from command args.
    const snapInId = events[0].context.snap_in_id;
    // const devrevPAT = event.context.secrets.service_account_token;
    // const baseURL = event.execution_metadata.devrev_endpoint;
    const inputs = events[0].input_data.global_values;
    // let parameters:string = event.payload.parameters.trim();
    const tags = events[0].input_data.resources.tags;
    let parameters:string = events[0].payload.parameters.trim();
    let numreviews= 10
    numreviews = parseInt(parameters);

	const response = await fetch(`https://g2-data-api.p.rapidapi.com/g2-products/?product=${inputs['slug']}`, {
	method: 'GET',
	headers: {
		'X-RapidAPI-Key': 'a5c69aa55emshf8282efe0cc1955p1d4395jsn9c79db8d63ea',
		'X-RapidAPI-Host': 'g2-data-api.p.rapidapi.com'
	}
}).then(response => response.json()).then(response => response.initial_reviews);


    for(const review of response) {

      const reviewText = `The Review: ${review.review_content}`;
      const reviewTitle = `Ticket created from G2 ${review.review_id}`;
      // const reviewID = review.id;
      const systemPrompt = `you are an expert at cleaning, lablelling, categorising and analysing the given G2 reviews for the company ${inputs['slug']}.You will recieve a review. The output should be json with fields: "Relevance", "Sentiments", "Category", "sub_category", "Severity", "Feature" , "insight", "description", "response" and "review". Under "Relevance" write false if the text is not related to the company or it is a general statement otherwise mention true. Under "Sentiment" mention the sentiment of the tweet. For "Category" mention if is a "bug", "complaint", "general_feedback", "suggestion", "praise", "security_concern", "pricing" or "question". Under "sub_category" if "Category" is "bug" then choose between "blocking", "major", "minor" or "trivial", if "Category is "complaint" choose between "functional", "usability", "performance" or "customer service", if "Category" is "general feedback" then "sub_category" will be "-" , if "Category" is "security concern" then "sub_category" will be "vulnerability" or "privacy issue", if "Category" is "question" then "sub_category" will be "-" , if "Category" is "pricing" then "sub_category" will be "expensive", "cheap" or "value for money", if "Category" is "praise" then "sub_category" will be what benefit was received. Under "Feature" mention the feature that the review is about.Under "Severity" choose between "blocker", "high", "low" or "medium". Under "insight" mention the action elaborately that the company should take based on the review. Under "description" mention the elaborate description of the problem. Under "response" add an elaborate professional response to the customer from the company. Under "review" add the review after removing all links starting with "https://t.co/". Review: ${review.review_content}`;
      const humanPrompt = ``;

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
          
          prompt: `you are an expert at cleaning, lablelling, categorising and analysing the given Trustpilot reviews for the company ${inputs['slug']}. You will recieve a review. The output should be json with fields: "Relevance", "Sentiments", "Category", "sub_category", "Severity", "Feature" , "insight", "description", "response" and "review". Under "Relevance" write false if the text is not related to the company or it is a general statement otherwise mention true. Under "Sentiment" mention the sentiment of the tweet between "Positive" or "Negative". For "Category" choose only between a "bug", "complaint", "general_feedback", "suggestion", "praise", "security_concern", "pricing" or "question". Under "sub_category" if "Category" is "bug" then choose between "blocking", "major", "minor" or "trivial", if "Category is "complaint" choose between "functional", "usability", "performance" or "customer service", if "Category" is "general feedback" then "sub_category" will be "-" , if "Category" is "security_concern" then "sub_category" will be "vulnerability" or "privacy issue", if "Category" is "question" then "sub_category" will be "-" , if "Category" is "pricing" then "sub_category" will be "expensive", "cheap" or "value for money", if "Category" is "praise" then "sub_category" will be what benefit was received. Under "Feature" mention the feature that the review is about.Under "Severity" choose between "Blocker", "High", "Low" or "Medium". Under "insight" mention the action elaborately that the company should take based on the review. Under "description" mention the elaborate description of the problem. Under "response" add an elaborate professional response to the customer from the company. Under "review" add the review after removing all links starting with "https://t.co/". The review: ${review.review_content}`,
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
    
    let body= `The review: ${review.review_content} \n
  The description: ${ans.description} \n
    `
    if(ans.Relevance=true){
      // Create a ticket with title as review title and description as review text.
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
     
      let subcat  = await apiUtil.postTextMessage(ticketID, `Sub-Category: ${ans.sub_category} `);
      let sentiment  = await apiUtil.postTextMessage(ticketID, `Overall sentiment: ${ans.Sentiments} `);
      let feature  = await apiUtil.postTextMessage(ticketID, `Feature discussed: ${ans.Feature} `);
      let insight  = await apiUtil.postTextMessage(ticketID, `Actionable insight: \n
    ${ans.insight} \n`);
      let sample  = await apiUtil.postTextMessage(ticketID, `Sample Response: ${ans.response} `);
    }
  }
    // Call an LLM to categorize the review as Bug, Feature request, or Question.

  }


export default run;
