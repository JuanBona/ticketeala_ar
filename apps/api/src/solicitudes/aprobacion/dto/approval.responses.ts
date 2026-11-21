// Response body of the approval endpoints (UC-01 steps 9 to 13).
import { QuoteView } from '../../../cotizaciones/dto/quote.responses.js';
import { TravelRequestSummary } from '../../dto/travel-request.responses.js';

/** What the approver reviews (step 12): the request with its justifications and the chosen quote. */
export class ApprovalView extends TravelRequestSummary {
  selectedQuote: QuoteView | null;
}
