i would like to add a page to which i can add a link from a site, this app runs playwrite, fetch for the sitemap.xml and saves all the links into a collection in mongodb.
than another process will read the links from the collection and run playwright to fetch the content of each page and save it into another collection in mongodb. finally i would like to have a simple frontend page where i can see the status of the links (pending, in progress, done, error) and also be able to view the content saved for each link.

The MongoDB instance will be accessible at `mongodb://localhost:27017` with the default database name `sv-app`. You can change these settings in the `docker-compose.yml` file if needed.

