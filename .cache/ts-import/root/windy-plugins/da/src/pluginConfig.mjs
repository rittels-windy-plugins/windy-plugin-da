const config = {
    name: 'windy-plugin-da',
    version: '0.3.25',
    icon: '⛰',
    title: 'Multipicker',
    description: 'The picker shows the density altitude and other information,  provides a multi-picker.',
    author: 'Rittels',
    repository: 'https://www.github.com/rittels-windy-plugins/windy-plugin-da.git',
    desktopUI: 'embedded',
    mobileUI: 'small',
    listenToSingleclick: true,
    routerPath: '/multipicker/:lat?/:lon?',
    addToContextmenu: true,
};
export default config;
