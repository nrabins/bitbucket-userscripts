// ==UserScript==
// @name         Bitbucket Search - Hide Repos/Projects
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Hides repositories and/or projects from bitbucket search results
// @author       Nate Rabins
// @match        <bitbucketdomain>/plugins/servlet/search?q=*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  const $ = window.jQuery;
  const STORAGE_KEY = "hidden projects/repos";

  let projectsToHide, reposToHide;

  let enforceHidden = true;

  /* UI Elements */
  let $filesHiddenText, $showHiddenFilesButton, $editFilterButton, $filter;

  /* Storage */
  function loadToHides() {
      const storedToHides = window.localStorage.getItem(STORAGE_KEY);
      if (storedToHides === null) {
          projectsToHide = [];
          reposToHide = [];
      } else {
          const json = JSON.parse(storedToHides);
          projectsToHide = json.projects;
          reposToHide = json.repos;
      }
  }
  loadToHides();

  function saveToHides() {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          projects: projectsToHide, repos: reposToHide
      }));
  }

  /* Hide Options */
  function setUpHeaderOptions() {
      const $header = $('h4.result-summary');
      //$header.css('margin-bottom', 0);

      $filter = $('<div id="filter"><div class="filter-list-container"><ul style="list-style-type:none;"></ul></div></div>');
      $filter.css({
          display: 'flex',
          'justify-content': 'flex-end',
          padding: '0px 15px 0px 0px'
      });
      $filter.hide();
      $header.after($filter);

      const $words = $header.wrapInner('<div></div>');

      $filesHiddenText = $('<span id="files-hidden-text"></span>').css({
          'margin-left': '5px',
          'font-style': 'italic'
      }).hide();
      $words.find('div').append($filesHiddenText);

      $header.css({
          display: 'flex',
          'justify-content': 'space-between'
      });

      const $buttons = $('<div></div>');

      $showHiddenFilesButton = $('<button id="show-hidden" class="aui-button">Show Hidden</button>')
          .click(function () {
              enforceHidden = !enforceHidden;
              applyFilter();
              $(this).text(enforceHidden ? "Show Hidden" : "Resume Hiding");
              if (!enforceHidden) {
                  // close the filter if we're showing hidden files
                  $filter.hide();
              }
          });
      $buttons.append($showHiddenFilesButton);

      $editFilterButton = $('<button id="edit-filter" class="aui-button">Edit Filter</button>')
          .click(function () {
          if ($filter.is(':hidden')) {
              showFilter();
          } else {
              hideFilter();
          }
      });
      $buttons.append($editFilterButton);

      $header.append($buttons);

      updateFilter();
  }

  function showFilter() {
      $filter.show();
  }

  function hideFilter() {
      $filter.hide();
  }

  function updateFilter() {
      const $filterList = $filter.find('ul');
      $filterList.empty();

      if (projectsToHide.length > 0) {
          $filterList.append(makeSectionHeader('Projects', false));
      }

      projectsToHide.sort();
      projectsToHide.forEach(project => {
          $filterList.append(makeRulesListItem(true, project));
      });

      if (reposToHide.length > 0) {
          $filterList.append(makeSectionHeader('Repositories', projectsToHide.length > 0));
      }

      reposToHide.sort((a, b) => {
          if (a.project === b.project) {
              return a.repo.toUpperCase() > b.repo.toUpperCase() ? 1 : -1;
          }
          return a.project.toUpperCase() > b.project.toUpperCase() ? 1 : -1;
      });
      reposToHide.forEach(repo => {
          $filterList.append(makeRulesListItem(false, repo.project, repo.repo));
      });

      const hasNoRules = projectsToHide.length == 0 && reposToHide.length == 0;
      if (hasNoRules) {
          hideFilter();
      }
      $showHiddenFilesButton.prop({
          'disabled': hasNoRules,
          'title': hasNoRules ? 'No filter exists' : 'Show hidden files'
      });
      $editFilterButton.prop({
          'disabled': hasNoRules,
          'title': hasNoRules ? 'No filter exists' : 'Show current filter'
      });
  }

  function makeSectionHeader(text, padTop) {
      return $(`<li style='text-align:right; ${padTop ? 'margin-top:20px':''}'>${text}</li>`).css('font-style', 'italic');
  }

  function makeRulesListItem(isProject, project, repo) {
      const $listItem = $('<li style="margin:5px; text-align:right;"></li>').text(isProject ? project : `${project} → ${repo}`);
      const $deleteButton = $('<button class="aui-button" style="margin-left:5px;" title="Remove rule">X</button>');
      $deleteButton.click(function () {
          let itemRemoved = false;
          if (isProject) {
              const indexToDelete = projectsToHide.indexOf(project);
              if (indexToDelete !== -1) {
                  projectsToHide.splice(indexToDelete, 1);
                  itemRemoved = true;
              }
          } else {
              const indexToDelete = reposToHide.findIndex(repoToHide => {
                  return repoToHide.project === project && repoToHide.repo === repo
              });
              if (indexToDelete !== undefined) {
                  reposToHide.splice(indexToDelete, 1);
                  itemRemoved = true;
              }
          }
          if (itemRemoved) {
              saveAndApplyRules();
          }
      });

      $listItem.append($deleteButton);
      return $listItem;
  }

  function saveAndApplyRules() {
      saveToHides();
      updateFilter();
      applyFilter();
  }

  let initialListInterval = setInterval(function () {
      if ($('h4.result-summary').length != 0) {
          clearInterval(initialListInterval);
          setUpHeaderOptions();
      }
  }, 100);

  function shouldHideProject(projectName) {
      return projectsToHide.indexOf(projectName) >= 0;
  }

  function shouldHideRepo(projectName, repoName) {
      return reposToHide.some(repoToHide => repoToHide.project === projectName && repoToHide.repo === repoName);
  }

  function applyFilter() {
      const $results = $('ul.primary-results li.code-search-result');
      let filesHiddenCount = 0;
      $results.each(function () {
          const projectName = $(this).find('.code-search-project').text();
          const repoName = $(this).find('.code-search-repository').text();

          if (enforceHidden && (shouldHideProject(projectName) || shouldHideRepo(projectName, repoName))) {
              $(this).hide();
              filesHiddenCount++;
          } else {
              $(this).show();
          }
      });

      // If we're showing all results, disable the line buttons
      $('.tampermonkey-hide-button').prop("disabled", !enforceHidden);

      $filesHiddenText.text(`(${filesHiddenCount} hidden)`);
      if (filesHiddenCount > 0) {
          $filesHiddenText.show();
      } else {
          $filesHiddenText.hide();
      }

      $showHiddenFilesButton.prop('title', filesHiddenCount == 0 ? 'No files to hide' : 'Show hidden files');

      // There are times where we've hidden a lot and there may be few or no results on the first page.
      // To get around this, we manually trigger a scroll event to tell the page to check and see if it can load more.
      const container = $('.primary-results-container')[0];
      container.dispatchEvent(new Event('scroll'));
  }

  // Look for DOM changes (which might indicate a new search has been entered in the page itself OR we have new data to add buttons to)
  setInterval(function () {
      if ($('#filter').length === 0) {
          // Our header row option buttons have been destroyed by DOM changes, reinitialize them!
          setUpHeaderOptions();
      }

      const $results = $('ul.primary-results li.code-search-result');
      const $resultsWithoutButtons = $results.filter(function (index) {
          return $('.tampermonkey-hide-button', this).length == 0;
      });
      if ($resultsWithoutButtons.length > 0) {
          $resultsWithoutButtons.each(function () {
              const projectName = $(this).find('.code-search-project').text();
              const repoName = $(this).find('.code-search-repository').text();
              $(this).find('section header')
                  .append(makeButton(projectName, repoName, true))
                  .append(makeButton(projectName, repoName, false));
          });
          applyFilter();
      }
  }, 100);

  function makeClickHandler(projectName, repoName, isProject) {
      return function () {
          if (isProject) {
              projectsToHide.push(projectName);
          } else {
              reposToHide.push({
                  project: projectName,
                  repo: repoName
              });
          }
          saveAndApplyRules();
      }
  }

  function makeButton(projectName, repoName, isProject) {
      const title = `Prevent this ${isProject ? 'project' : 'repository'} from showing up in this and future searches`;
      const $button = $(`<button class="tampermonkey-hide-button aui-button" style="margin-left:10px;" title="${title}">Hide ${isProject ? 'Project' : 'Repo'}</button>`);
      $button.click(makeClickHandler(projectName, repoName, isProject));
      return $button;
  }
})();