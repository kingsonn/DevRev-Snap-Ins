import {publicSDK } from '@devrev/typescript-sdk';
import { ApiUtils, HTTPResponse } from './utils';
import {LLMUtils} from './llm_utils';
export const run = async (events: any[]) => {
  for (const event of events) {
    const endpoint: string = event.execution_metadata.devrev_endpoint;
    const token: string = event.context.secrets.service_account_token;
    const fireWorksApiKey: string = event.input_data.keyrings.fireworks_api_key;
    const apiUtil: ApiUtils = new ApiUtils(endpoint, token);
    // Get the number of reviews to fetch from command args.
    const snapInId = event.context.snap_in_id;
    const devrevPAT = event.context.secrets.service_account_token;
    const baseURL = event.execution_metadata.devrev_endpoint;
    const inputs = event.input_data.global_values;
    let parameters:string = event.payload.parameters.trim();
    const tags = event.input_data.resources.tags;
    const llmUtil: LLMUtils = new LLMUtils(fireWorksApiKey, `accounts/fireworks/models/${inputs['llm_model_to_use']}`, 4200);
    let numReviews = 10;
    let commentID : string | undefined;
    if (parameters === 'help') { 
      // Send a help message in CLI help format.
      const helpMessage = `twitter_voc - Fetch reviews from twitter and create tickets in DevRev.\n\nUsage: /twitter_voc <number_of_reviews_to_fetch>\n\n\`number_of_reviews_to_fetch\`: Number of reviews to fetch from Twitter. Should be a number between 1 and 100. If not specified, it defaults to 10.`;
      let postResp  = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, helpMessage, 1);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }
      continue
    }
    let postResp: HTTPResponse = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, 'Fetching reviews from Google Reviews', 1);
    if (!postResp.success) {
      console.error(`Error while creating timeline entry: ${postResp.message}`);
      continue;
    }
    if (!parameters) {
      // Default to 10 reviews.
      parameters = '10';
    }
    try {
      numReviews = parseInt(parameters);

      if (!Number.isInteger(numReviews)) {
        throw new Error('Not a valid number');
      }
    } catch (err) {
      postResp  = await apiUtil.postTextMessage(snapInId, 'Please enter a valid number', commentID);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }
      commentID = postResp.data.timeline_entry.id;
    }
    // Make sure number of reviews is <= 100.
    if (numReviews > 100) {
      postResp  = await apiUtil.postTextMessage(snapInId, 'Please enter a number less than 100', commentID);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }
      commentID = postResp.data.timeline_entry.id;
    }
    // Call google playstore scraper to fetch those number of reviews.
    // let getReviewsResponse:any = await gplay.reviews({
    //   appId: inputs['app_id'],
    //   sort: gplay.sort.RATING,
    //   num: numReviews,
    //   throttle: 10,
    // });

  
    // try {

    const url = 'https://google-reviews-scraper.p.rapidapi.com/?id=U2FsdGVkX1%252F8GUUq17u0Yi%252BrtxMkNkUMAYn%252BaV95mi%252B3DFQVlhH1%252F7wT8%252FYx%252FDklSqo1IHA32nPTq2K%252BVJX%252FOw%253D%253D&sort=relevant&nextpage=false';
    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': 'cd96441afemsh0ebe45c0b03839ap1a0d06jsnf4bf602e232f',
        'X-RapidAPI-Host': 'google-reviews-scraper.p.rapidapi.com'
      }
    };
    

      const response = await fetch(url, options);
      const result = await response.json();
      console.log(result);
 
    // } catch (error) {
    //   if (error instanceof Error) {
    //     console.log('error message:', error.message);
    //     return error.message;
    //   } 
    // }
  
    // Post an update about the number of reviews fetched.
    postResp  = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `Fetched ${numReviews} reviews, creating tickets now.`, 1);
    if (!postResp.success) {
      console.error(`Error while creating timeline entry: ${postResp.message}`);
      continue;
    }
    commentID = postResp.data.timeline_entry.id;
    // let reviews:gplay.IReviewsItem[] = getReviewsResponse.data;
    // For each review, create a ticket in DevRev.
    // const data = await getData(inputs['company_id'], numReviews)
    for(const review of result.reviews) {
      // Post a progress message saying creating ticket for review with review URL posted.
      postResp  = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `Creating ticket for review by: ${review.author}`, 1);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }
      const reviewText = `The Review: ${review.comment}`;
      const reviewTitle = `Ticket created from google review by ${review.author}`;
      // const reviewID = review.id;
      const systemPrompt = `you are an expert at cleaning, lablelling, categorising and analysing the given google reviews for the company ${inputs['company']}.You will recieve a review. The output should be json with fields: "Relevance", "Sentiments", "Category", "sub-category", "Severity", "Feature" , "insight", "description", "response" and "review". Under "Relevance" write false if the text is not related to the company or it is a general statement otherwise mention true. Under "Sentiment" mention the sentiment of the tweet. For "Category" mention if is a "bug", "complaint", "general_feedback", "suggestion", "praise", "security_concern", "pricing" or "question". Under "sub-category" if "Category" is "bug" then choose between "blocking", "major", "minor" or "trivial", if "Category is "complaint" choose between "functional", "usability", "performance" or "customer service", if "Category" is "general feedback" then "sub-category" will be "-" , if "Category" is "security concern" then "sub-category" will be "vulnerability" or "privacy issue", if "Category" is "question" then "sub-category" will be "-" , if "Category" is "pricing" then "sub-category" will be "expensive", "cheap" or "value for money", if "Category" is "praise" then "sub-category" will be what benefit was received. Under "Feature" mention the feature that the review is about.Under "Severity" choose between "blocker", "high", "low" or "medium". Under "insight" mention the action elaborately that the company should take based on the review. Under "description" mention the elaborate description of the problem. Under "response" add an elaborate professional response to the customer from the company. Under "review" add the review after removing all links starting with "https://t.co/". Review: ${review.comment}`;
      const humanPrompt = ``;

      let llmResponse = {};
      try {
        llmResponse = await llmUtil.chatCompletion(systemPrompt, humanPrompt, {review: (reviewTitle ? reviewTitle + '\n' + reviewText: reviewText)})
        console.log(llmResponse)
      } catch (err) {
        console.error(`Error while calling LLM: ${err}`);
      }
    ;
      let summary = [];
      let inferredCategory = 'failed_to_infer_category';
      let desc = 'could not generate'
      if ('description' in llmResponse){
        desc = llmResponse['description'] as string
      }
      let sen = 'could not generate'
      if ('Sentiments' in llmResponse){
        sen = llmResponse['Sentiments'] as string
      }
      let sub = 'could not generate'
      if ('sub-category' in llmResponse){
        sub = llmResponse['sub-category'] as string
      }
      let fea = 'could not generate'
      if ('Feature' in llmResponse){
        fea = llmResponse['Feature'] as string
      }
      let sam = 'could not generate'
      if ('response' in llmResponse){
        sam = llmResponse['response'] as string
      }
      let ins = 'could not generate'
      if ('insight' in llmResponse){
        ins = llmResponse['insight'] as string
      }
      let iss = false
      if ('Relevance' in llmResponse){
        iss = llmResponse['Relevance'] as boolean
      }
      let sev = 'medium'
      if ('Severity' in llmResponse){
        sev = llmResponse['Severity'] as string
      }
    
      if ('Category' in llmResponse) {
        inferredCategory = llmResponse['Category'] as string;
        if (!(inferredCategory in tags)) {
          inferredCategory = 'failed_to_infer_category';
        }
      }
      let body= `The review: ${review.comment} \n
      The description: ${desc} \n
      `
      if(iss=true){
      // Create a ticket with title as review title and description as review text.
      const createTicketResp = await apiUtil.createTicket({
        title: reviewTitle,
        tags: [{id: tags[inferredCategory].id}],
        body: body,
        type: publicSDK.WorkType.Ticket,
        owned_by: [inputs['default_owner_id']],
        applies_to_part: inputs['default_part_id'],
        // is_spam: iss,
        // source_channel:'Twitter',
        // severity: sev='medium'?publicSDK.TicketSeverity.Medium: sev='blocker'?publicSDK.TicketSeverity.Blocker:sev='low'?publicSDK.TicketSeverity.Low:publicSDK.TicketSeverity.High 
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
      let subcat  = await apiUtil.postTextMessage(ticketID, `Sub-Category: ${sub} `);
  let sentiment  = await apiUtil.postTextMessage(ticketID, `Overall sentiment: ${sen} `);
      let feature  = await apiUtil.postTextMessage(ticketID, `Feature affected: ${fea} `);
      let insight  = await apiUtil.postTextMessage(ticketID, `Actionable insight: ${ins} `);
      let sample  = await apiUtil.postTextMessage(ticketID, `Sample Response ${sam} `);
    }
  }
    // Call an LLM to categorize the review as Bug, Feature request, or Question.
    break
  }
};

export default run;
