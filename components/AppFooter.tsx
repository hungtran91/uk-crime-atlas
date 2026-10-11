export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="page caption">
        <p>
          Crime data: <a href="https://data.police.uk/">data.police.uk</a>. Population estimates and police force
          area boundaries: <a href="https://www.ons.gov.uk/">Office for National Statistics</a>. Contains public
          sector information licensed under the{" "}
          <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">
            Open Government Licence v3.0
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
