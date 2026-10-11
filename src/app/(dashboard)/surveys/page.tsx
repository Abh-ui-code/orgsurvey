import { Suspense } from "react";
import SurveyListPage from "./SurveyListPage";

// The list reads its starting filters from the address (?status=returned), so
// it must sit under a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <SurveyListPage />
    </Suspense>
  );
}
