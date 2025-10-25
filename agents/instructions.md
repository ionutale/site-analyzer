i would like to add a page to which i can add a link from a site, this app runs playwrite, fetch for the sitemap.xml and saves all the links into a collection in mongodb.
than another process will read the links from the collection and run playwright to fetch the content of each page and save it into another collection in mongodb. finally i would like to have a simple frontend page where i can see the status of the links (pending, in progress, done, error) and also be able to view the content saved for each link.

The MongoDB instance will be accessible at `mongodb://localhost:27017` with the default database name `sv-app`. You can change these settings in the `docker-compose.yml` file if needed.

---

instruction 2
i also want to analyze the site for SEO purposes, so i want to save the title, meta description, content type, status code and a text excerpt of the page.

add a side drawer in the frontend page where i can see all the different pages.
add a page details view where i can see the saved information for each page.
add a page with the SEO analysis results, showing common SEO issues found across the pages (e.g., missing title, missing meta description, slow loading pages, etc.)
add filters to the main dashboard to filter links by status, and search by URL.

the home page should show a dashboard with cards with all sites added, number of pages analyzed, number of pages with errors, average load time, etc.

add a side drawer in the frontend page where i can see navigate all the tools available for site analysis and SEO.
