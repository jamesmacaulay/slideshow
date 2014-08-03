/** @jsx React.DOM */

var clientID = "06f0e80490044ad993f6cb6fd79e1149";
var redirectURI = "http://jamesmacaulay.github.io/slideshow";
var delay = 3000;
var tag = "caribana";

var Promise = require('es6-promise').Promise;
var jQuery = window.jQuery = require('jquery');
var mori = window.mori = require('mori');
var Bacon = window.Bacon = require('baconjs');

var React = require('react');
var pkg = require('./package.json');
var BaconMixin = require('react-bacon').BaconMixin;

var Instagram = window.Instagram = {
  get: function(url) {
    var response = Promise.resolve(jQuery.ajax(url, {dataType: 'jsonp'}));
    return response.then(function(data) {
      if (data.meta && data.meta.code !== 200) {
        throw new Error(data.data.message);
      }
      return mori.js_to_clj(data.data);
    });
  },
  getRecentImagesForTag: function(tag, accessToken) {
    var mediaPromise = Instagram.get("https://api.instagram.com/v1/tags/"+tag+"/media/recent?access_token="+accessToken);
    return mediaPromise.then(function(media) {
      function isImage(m) { return mori.get(m, "type") === "image"; }
      return mori.filter(isImage, media);
    });
  }
};

var Authenticator = React.createClass({
  accessTokenFromLocation: function(loc) {
    var matches = window.location.hash.match(/#access_token=(.*)/);
    return matches ? matches[1] : null;
  },
  redirectToAuthenticate: function() {
    window.location.href = "https://instagram.com/oauth/authorize/?client_id="+clientID+"&redirect_uri="+redirectURI+"&response_type=token";
  },
  getInitialState: function() {
    return({
      accessToken: this.accessTokenFromLocation(window.location)
    });
  },
  componentWillMount: function() {
    if (!this.state.accessToken) {
      redirectToAuthenticate();
    }
  },
  render: function() {
    return(
      <Slideshow accessToken={this.state.accessToken} />
    );
  }
});


function urlFromImage(image) {
  return mori.get_in(image, ["images", "standard_resolution", "url"]);
};

function prefetch(images) {
  mori.each(images, function(image) {
    var img = document.createElement('img');
    img.src = urlFromImage(image);
  });
  return images;
};

var Slideshow = React.createClass({
  mixins: [BaconMixin],
  getInitialState: function() {
    return({
      tag: tag,
      currentImage: null,
      remainingImages: mori.vector()
    });
  },
  getImageList: function() {
    return(Bacon.fromPromise(
      Instagram.getRecentImagesForTag(this.state.tag, this.props.accessToken).then(prefetch)
    ));
  },
  componentWillMount: function() {
    var remainingImagesProperty = this.stateProperty("remainingImages").skipDuplicates(mori.equals);
    this.plug(remainingImagesProperty.changes().map(mori.first), "currentImage");
    this.plug(remainingImagesProperty.sample(delay).map(mori.rest), "remainingImages");
    var dwindling = remainingImagesProperty.map(function(images) {
      return mori.count(images) < 3;
    }).skipDuplicates().filter(mori.identity);

    var fetches = dwindling.flatMap(this.getImageList);
    this.plug(fetches, "remainingImages");
  },
  render: function() {
    if (this.state.currentImage) {
      return(
        <div>
          <h1>#{this.state.tag}</h1>
          <img src={urlFromImage(this.state.currentImage)} />
        </div>
      );
    } else {
      return(
        <div>
          <h1>#{this.state.tag}</h1>
        </div>
      );
    }
    
  }
});

React.renderComponent(<Authenticator />, document.body);
